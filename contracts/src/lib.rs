#![no_std]

mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractevent, contractimpl, token, Address, Env, IntoVal, Vec};
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
    pub fn initialize(env: Env, admin: Address, asset: Address) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::AllowedAsset, &asset);
        
        env.storage().instance().set(&DataKey::DisbursementCount, &0u64);
        
        Ok(())
    }

    pub fn create_and_execute_disbursement(
        env: Env,
        sender: Address,
        total_amount: i128,
        recipients: Vec<RecipientShare>,
    ) -> Result<u64, ContractError> {
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

        let mut final_recipients = Vec::new(&env);
        let mut sum_amounts: i128 = 0;

        for share in recipients.iter() {
            let amt = (total_amount * (share.percentage as i128)) / (PERCENTAGE_TOTAL_BPS as i128);
            sum_amounts += amt;

            final_recipients.push_back(RecipientShare {
                recipient: share.recipient,
                percentage: share.percentage,
                amount: amt,
            });
        }

        let remainder = total_amount - sum_amounts;
        if remainder > 0 {
            let mut first = final_recipients.get(0).unwrap();
            first.amount += remainder;
            final_recipients.set(0, first);
        }

        let token_client = token::Client::new(&env, &asset);
        let contract_address = env.current_contract_address();

        token_client.transfer(&sender, &contract_address, &total_amount);

        for share in final_recipients.iter() {
            if share.amount > 0 {
                token_client.transfer(&contract_address, &share.recipient, &share.amount);
            }
        }

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

        env.storage().persistent().set(&DataKey::Disbursement(current_id), &disbursement);

        let mut sender_disbursements: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::SenderDisbursements(sender.clone()))
            .unwrap_or(Vec::new(&env));
        sender_disbursements.push_back(current_id);
        env.storage()
            .persistent()
            .set(&DataKey::SenderDisbursements(sender.clone()), &sender_disbursements);

        for share in final_recipients.iter() {
            let mut recipient_disbursements: Vec<u64> = env
                .storage()
                .persistent()
                .get(&DataKey::RecipientDisbursements(share.recipient.clone()))
                .unwrap_or(Vec::new(&env));
            recipient_disbursements.push_back(current_id);
            env.storage()
                .persistent()
                .set(&DataKey::RecipientDisbursements(share.recipient.clone()), &recipient_disbursements);
        }

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

    pub fn get_disbursement(env: Env, id: u64) -> Result<Disbursement, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Disbursement(id))
            .ok_or(ContractError::DisbursementNotFound)
    }

    pub fn get_disbursements_by_sender(env: Env, sender: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::SenderDisbursements(sender))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_disbursements_by_recipient(env: Env, recipient: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::RecipientDisbursements(recipient))
            .unwrap_or(Vec::new(&env))
    }

    pub fn deposit_to_blend(env: Env, user: Address, amount: i128) -> Result<(), ContractError> {
        user.require_auth();

        let blend_pool = Address::from_string(&soroban_sdk::String::from_str(
            &env,
            "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF",
        ));
        let usdc_address = Address::from_string(&soroban_sdk::String::from_str(
            &env,
            "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU",
        ));

        let request = BlendRequest {
            request_type: 2, // 2 = SupplyCollateral
            address: usdc_address,
            amount,
        };
        let requests = soroban_sdk::vec![&env, request];

        let args: soroban_sdk::Vec<soroban_sdk::Val> = soroban_sdk::vec![
            &env,
            user.clone().into_val(&env), // from
            user.clone().into_val(&env), // spender
            user.clone().into_val(&env), // to
            requests.into_val(&env),     // requests
        ];

        let _: soroban_sdk::Val = env.invoke_contract(
            &blend_pool,
            &soroban_sdk::Symbol::new(&env, "submit"),
            args,
        );

        Ok(())
    }

    pub fn withdraw_from_blend(env: Env, user: Address, amount: i128) -> Result<(), ContractError> {
        user.require_auth();

        let blend_pool = Address::from_string(&soroban_sdk::String::from_str(
            &env,
            "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF",
        ));
        let usdc_address = Address::from_string(&soroban_sdk::String::from_str(
            &env,
            "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU",
        ));

        let request = BlendRequest {
            request_type: 3, // 3 = WithdrawCollateral
            address: usdc_address,
            amount,
        };
        let requests = soroban_sdk::vec![&env, request];

        let args: soroban_sdk::Vec<soroban_sdk::Val> = soroban_sdk::vec![
            &env,
            user.clone().into_val(&env), // from
            user.clone().into_val(&env), // spender
            user.clone().into_val(&env), // to
            requests.into_val(&env),     // requests
        ];

        let _: soroban_sdk::Val = env.invoke_contract(
            &blend_pool,
            &soroban_sdk::Symbol::new(&env, "submit"),
            args,
        );

        Ok(())
    }
}

#[soroban_sdk::contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BlendRequest {
    pub request_type: u32,
    pub address: Address,
    pub amount: i128,
}
