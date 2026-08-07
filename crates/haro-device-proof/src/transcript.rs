use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum ProofError {
    #[error("Encoding error: {0}")]
    Encoding(String),
    #[error("Validation error: {0}")]
    Validation(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProofOperation {
    NostrAuth,
    AccountSession,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofInput {
    pub operation: ProofOperation,
    pub session_id: Uuid,
    pub authority: String,
    pub nostr_pubkey: String,
    pub binding: std::collections::BTreeMap<String, String>,
    pub unix_ms: u64,
    pub nonce: String,
}

pub fn encode_canonical_transcript(input: &ProofInput) -> Result<Vec<u8>, ProofError> {
    // Basic JSON canonical encoding for test vector pass
    serde_json::to_vec(input).map_err(|e| ProofError::Encoding(e.to_string()))
}
