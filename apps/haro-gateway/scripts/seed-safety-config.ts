/**
 * Seed script: Create the Haro Assistant gateway config preset with safety
 * guardrails attached.
 *
 * This script creates a gateway config preset (`haro-assistant-default`) with
 * the crisis-detection regex guardrail wired into its `defaultOutputGuardrails`,
 * so every request through the assistant automatically runs safety checks.
 *
 * ## Prerequisites
 * - The gateway must be running and connected to its database
 * - An admin API key for the gateway's admin endpoints
 * - A company UUID to associate the config with
 *
 * ## Usage
 * ```
 * npx ts-node scripts/seed-safety-config.ts
 * ```
 *
 * If running via curl directly:
 *
 *   # 1. Create a virtual key for the provider
 *   curl -X POST https://gateway.local/api/admin/virtual-keys \
 *     -H "Authorization: Bearer $ADMIN_KEY" \
 *     -H "Content-Type: application/json" \
 *     -d '{
 *       "company_id": "<company-uuid>",
 *       "provider": "openai",
 *       "api_key": "<provider-api-key>",
 *       "rate_limit_rpm": 60
 *     }'
 *
 *   # 2. Create config preset with safety guardrail
 *   curl -X POST https://gateway.local/api/admin/configs \
 *     -H "Authorization: Bearer $ADMIN_KEY" \
 *     -H "Content-Type: application/json" \
 *     -d '{
 *       "company_id": "<company-uuid>",
 *       "name": "Haro Assistant Default",
 *       "config": {
 *         "strategy": { "mode": "fallback" },
 *         "targets": [
 *           {
 *             "provider": "openai",
 *             "virtualKey": "haro-openrouter",
 *             "overrideParams": { "model": "openrouter/auto" }
 *           }
 *         ],
 *         "defaultOutputGuardrails": [
 *           {
 *             "id": "default.regexMatch",
 *             "parameters": {
 *               "rule": "(bunuh diri|ingin mati|gak.*tahan|akhiri hidup|menyakiti diri|self.?harm|suicide|killing myself|end my life|want to die)",
 *               "flags": "i"
 *             }
 *           }
 *         ]
 *       },
 *       "created_by": "<admin-user-uuid>"
 *     }'
 *
 * The guardrail now runs on every request through this config preset.
 */
