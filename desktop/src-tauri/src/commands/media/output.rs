use serde::Serialize;

use super::BlobDescriptor;

/// Exact metadata for the bytes passed to the Blossom upload request after
/// native transcoding and sanitization.
#[derive(Debug, Clone, Serialize)]
pub struct NativeMediaOutput {
    /// MIME type sent in the native upload request.
    #[serde(rename = "mimeType")]
    pub mime_type: String,
    /// Lowercase SHA-256 of the exact request body.
    pub sha256: String,
    /// Byte length of the exact request body.
    pub size: u64,
}

/// IPC result for raw-byte uploads, including both the relay descriptor and
/// Rust's independently computed output-byte contract.
#[derive(Debug, Clone, Serialize)]
pub struct NativeMediaUploadResult {
    /// Descriptor returned and verified from the relay.
    pub descriptor: BlobDescriptor,
    /// Independently computed contract for the uploaded bytes.
    pub output: NativeMediaOutput,
}

pub(super) fn validate_uploaded_descriptor(
    descriptor: &BlobDescriptor,
    output: &NativeMediaOutput,
) -> Result<(), String> {
    if descriptor.mime_type != output.mime_type {
        return Err("relay media descriptor MIME does not match uploaded bytes".to_string());
    }
    if !descriptor.sha256.eq_ignore_ascii_case(&output.sha256) {
        return Err("relay media descriptor SHA-256 does not match uploaded bytes".to_string());
    }
    if descriptor.size != output.size {
        return Err("relay media descriptor size does not match uploaded bytes".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use sha2::{Digest, Sha256};

    use super::*;

    fn descriptor_for_output(output: &NativeMediaOutput) -> BlobDescriptor {
        BlobDescriptor {
            url: format!("https://relay.example/media/{}", output.sha256),
            sha256: output.sha256.clone(),
            size: output.size,
            mime_type: output.mime_type.clone(),
            uploaded: 1,
            dim: None,
            blurhash: None,
            thumb: None,
            duration: None,
            image: None,
            filename: None,
        }
    }

    #[test]
    fn uploaded_descriptor_must_match_exact_native_output_bytes() {
        let body = [1_u8, 2, 3];
        let output = NativeMediaOutput {
            mime_type: "application/octet-stream".to_string(),
            sha256: hex::encode(Sha256::digest(body)),
            size: body.len() as u64,
        };
        let mut descriptor = descriptor_for_output(&output);

        assert!(validate_uploaded_descriptor(&descriptor, &output).is_ok());

        descriptor.sha256 = "0".repeat(64);
        assert_eq!(
            validate_uploaded_descriptor(&descriptor, &output).unwrap_err(),
            "relay media descriptor SHA-256 does not match uploaded bytes"
        );

        let mut descriptor = descriptor_for_output(&output);
        descriptor.mime_type = "text/plain".to_string();
        assert_eq!(
            validate_uploaded_descriptor(&descriptor, &output).unwrap_err(),
            "relay media descriptor MIME does not match uploaded bytes"
        );

        let mut descriptor = descriptor_for_output(&output);
        descriptor.size += 1;
        assert_eq!(
            validate_uploaded_descriptor(&descriptor, &output).unwrap_err(),
            "relay media descriptor size does not match uploaded bytes"
        );
    }
}
