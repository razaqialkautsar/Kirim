use soroban_sdk::{contracterror, contracttype, Address, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DisbursementStatus {
    Pending,
    Completed,
    Failed,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecipientShare {
    pub recipient: Address,
    pub percentage: u32, 
    pub amount: i128,    
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Disbursement {
    pub id: u64,
    pub sender: Address,
    pub total_amount: i128,
    pub asset: Address, 
    pub recipients: Vec<RecipientShare>,
    pub status: DisbursementStatus,
    pub created_at: u64, 
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    AllowedAsset,
    Disbursement(u64),
    DisbursementCount,
    SenderDisbursements(Address),
    RecipientDisbursements(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    InvalidPercentageTotal = 1,
    TooManyRecipients = 2,
    ZeroAmount = 3,
    DisbursementNotFound = 4,
    Unauthorized = 5,
    TransferFailed = 6,
    AlreadyInitialized = 7,
    NotInitialized = 8,
    EmptyRecipients = 9,
}

pub const MAX_RECIPIENTS: u32 = 5;

pub const PERCENTAGE_TOTAL_BPS: u32 = 10_000;
