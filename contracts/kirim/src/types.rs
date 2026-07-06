
use soroban_sdk::{contracterror, contracttype, Address, Vec};

/// Status eksekusi dari sebuah disbursement
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DisbursementStatus {
    Pending,
    Completed,
    Failed,
}

/// Representasi porsi pembagian dana untuk satu penerima
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecipientShare {
    pub recipient: Address,
    pub percentage: u32, // Basis points (contoh: 6000 = 60.00%)
    pub amount: i128,    // Dihitung dari total_amount * percentage
}

/// Representasi dari satu transaksi kiriman (disbursement) yang sedang diproses
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Disbursement {
    pub id: u64,
    pub sender: Address,
    pub total_amount: i128,
    pub asset: Address, // Contract address dari asset (TESTUSD) yang dikirim
    pub recipients: Vec<RecipientShare>,
    pub status: DisbursementStatus,
    pub created_at: u64, // Ledger timestamp
}

/// Key untuk membedakan data di Storage (Instance vs Persistent)
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Menyimpan Address admin kontrak (Instance Storage)
    Admin,
    /// Menyimpan Address asset USDC/TESTUSD yang diizinkan (Instance Storage)
    AllowedAsset,
    /// Menyimpan struct Disbursement berdasarkan ID (Persistent Storage)
    Disbursement(u64),
    /// Menyimpan counter/ID terakhir untuk auto-increment (Instance Storage)
    DisbursementCount,
}

/// Error khusus untuk validasi dan alur smart contract
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

/// Konstanta batas maksimal jumlah penerima (Sesuai kesepakatan di agents.md)
pub const MAX_RECIPIENTS: u32 = 5;

/// Konstanta total validasi persentase (100.00% dalam basis points = 10000)
pub const PERCENTAGE_TOTAL_BPS: u32 = 10_000;
