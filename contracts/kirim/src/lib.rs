#![no_std]

mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractevent, contractimpl, token, Address, Env, Vec};
use types::{
    ContractError, DataKey, Disbursement, DisbursementStatus, RecipientShare, MAX_RECIPIENTS,
    PERCENTAGE_TOTAL_BPS,
};

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisbursementCreated {
    pub id: u64,
    pub sender: Address,
    pub total_amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisbursementCompleted {
    pub id: u64,
}

#[contract]
pub struct KirimContract;

#[contractimpl]
impl KirimContract {
    /// Inisialisasi kontrak (Hanya boleh dipanggil sekali).
    /// Mengatur admin, alamat asset (TESTUSD SAC), dan counter Disbursement.
    pub fn initialize(env: Env, admin: Address, asset: Address) -> Result<(), ContractError> {
        // Cegah inisialisasi ganda dengan mengecek apakah Admin sudah ada
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }

        // Set admin dan allowed asset (TESTUSD)
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::AllowedAsset, &asset);
        
        // Inisialisasi DisbursementCount awal = 0
        env.storage().instance().set(&DataKey::DisbursementCount, &0u64);
        
        Ok(())
    }

    /// Membuat dan langsung mengeksekusi disbursement
    pub fn create_and_execute_disbursement(
        env: Env,
        sender: Address,
        total_amount: i128,
        recipients: Vec<RecipientShare>,
    ) -> Result<u64, ContractError> {
        // 1. VALIDASI INPUT
        sender.require_auth();

        let asset: Address = env
            .storage()
            .instance()
            .get(&DataKey::AllowedAsset)
            .ok_or(ContractError::NotInitialized)?;

        if total_amount <= 0 {
            return Err(ContractError::ZeroAmount);
        }

        let recipients_len = recipients.len();
        if recipients_len == 0 {
            return Err(ContractError::EmptyRecipients);
        }
        if recipients_len > MAX_RECIPIENTS {
            return Err(ContractError::TooManyRecipients);
        }

        let mut total_percentage = 0;
        for share in recipients.iter() {
            total_percentage += share.percentage;
        }

        if total_percentage != PERCENTAGE_TOTAL_BPS {
            return Err(ContractError::InvalidPercentageTotal);
        }

        // 2. HITUNG SPLIT
        let mut final_recipients = Vec::new(&env);
        let mut sum_amounts: i128 = 0;

        for share in recipients.iter() {
            let amt = (total_amount * (share.percentage as i128)) / (PERCENTAGE_TOTAL_BPS as i128);
            sum_amounts += amt;

            // Kita buat copy struct baru karena Vec di Soroban immutable per elemen 
            final_recipients.push_back(RecipientShare {
                recipient: share.recipient,
                percentage: share.percentage,
                amount: amt,
            });
        }

        // Aturan Rounding: sisa hasil pembulatan dialokasikan ke recipient PERTAMA
        let remainder = total_amount - sum_amounts;
        if remainder > 0 {
            let mut first = final_recipients.get(0).unwrap();
            first.amount += remainder;
            final_recipients.set(0, first);
        }

        // 3. TRANSFER
        let token_client = token::Client::new(&env, &asset);
        let contract_address = env.current_contract_address();

        // Escrow: Transfer dari sender ke contract
        token_client.transfer(&sender, &contract_address, &total_amount);

        // Disbursement: Transfer dari contract ke tiap recipient
        for share in final_recipients.iter() {
            if share.amount > 0 {
                token_client.transfer(&contract_address, &share.recipient, &share.amount);
            }
        }

        // 4. RECORD & EVENT
        let current_id: u64 = env.storage().instance().get(&DataKey::DisbursementCount).unwrap();
        let next_id = current_id + 1;
        env.storage().instance().set(&DataKey::DisbursementCount, &next_id);

        let disbursement = Disbursement {
            id: current_id,
            sender: sender.clone(),
            total_amount,
            asset: asset.clone(),
            recipients: final_recipients.clone(),
            status: DisbursementStatus::Completed,
            created_at: env.ledger().timestamp(),
        };

        // Simpan ke persistent storage
        env.storage().persistent().set(&DataKey::Disbursement(current_id), &disbursement);

        // Update list disbursement milik sender
        let mut sender_disbursements: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::SenderDisbursements(sender.clone()))
            .unwrap_or(Vec::new(&env));
        sender_disbursements.push_back(current_id);
        env.storage()
            .persistent()
            .set(&DataKey::SenderDisbursements(sender.clone()), &sender_disbursements);

        // Emit events
        DisbursementCreated {
            id: current_id,
            sender: sender.clone(),
            total_amount,
        }
        .publish(&env);

        DisbursementCompleted {
            id: current_id,
        }
        .publish(&env);

        Ok(current_id)
    }

    /// Membaca data Disbursement berdasarkan ID
    pub fn get_disbursement(env: Env, id: u64) -> Result<Disbursement, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Disbursement(id))
            .ok_or(ContractError::DisbursementNotFound)
    }

    /// Membaca semua ID Disbursement milik sender tertentu
    pub fn get_disbursements_by_sender(env: Env, sender: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::SenderDisbursements(sender))
            .unwrap_or(Vec::new(&env))
    }
}
