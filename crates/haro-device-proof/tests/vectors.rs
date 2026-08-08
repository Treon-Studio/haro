use haro_device_proof::ProofInput;

#[test]
fn test_vector_spec() {
    let raw = include_str!("../../../testdata/haro-device-proof-v1.json");
    let val: serde_json::Value = serde_json::from_str(raw).expect("valid json vector");
    let input: ProofInput = serde_json::from_value(val["websocket_auth"]["input"].clone()).unwrap();
    assert_eq!(input.authority, "ws://154.26.132.120:3000");
}
