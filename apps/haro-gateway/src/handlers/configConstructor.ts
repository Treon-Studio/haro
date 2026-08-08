import {
	ANTHROPIC,
	AZURE_AI_INFERENCE,
	AZURE_OPEN_AI,
	BEDROCK,
	CORTEX,
	FIREWORKS_AI,
	GOOGLE_VERTEX_AI,
	HUGGING_FACE,
	OPEN_AI,
	ORACLE,
	POWERED_BY,
	SAGEMAKER,
	STABILITY_AI,
	WORKERS_AI,
} from "../globals";
import { convertKeysToCamelCase } from "../utils";
import type { Options, Targets } from "../types/requestBody";

export function constructConfigFromRequestHeaders(
	requestHeaders: Record<string, any>,
): Options | Targets {
	const azureConfig = {
		resourceName: requestHeaders[`x-${POWERED_BY}-azure-resource-name`],
		deploymentId: requestHeaders[`x-${POWERED_BY}-azure-deployment-id`],
		apiVersion: requestHeaders[`x-${POWERED_BY}-azure-api-version`],
		azureAdToken: requestHeaders[`x-${POWERED_BY}-azure-ad-token`],
		azureAuthMode: requestHeaders[`x-${POWERED_BY}-azure-auth-mode`],
		azureManagedClientId:
			requestHeaders[`x-${POWERED_BY}-azure-managed-client-id`],
		azureWorkloadClientId:
			requestHeaders[`x-${POWERED_BY}-azure-workload-client-id`],
		azureEntraClientId: requestHeaders[`x-${POWERED_BY}-azure-entra-client-id`],
		azureEntraClientSecret:
			requestHeaders[`x-${POWERED_BY}-azure-entra-client-secret`],
		azureEntraTenantId:
			requestHeaders[`x-${POWERED_BY}-azure-entra-tenant-id`],
		azureModelName: requestHeaders[`x-${POWERED_BY}-azure-model-name`],
		openaiBeta:
			requestHeaders[`x-${POWERED_BY}-openai-beta`] ||
			requestHeaders[`openai-beta`],
		azureEntraScope: requestHeaders[`x-${POWERED_BY}-azure-entra-scope`],
	};

	const stabilityAiConfig = {
		stabilityClientId: requestHeaders[`x-${POWERED_BY}-stability-client-id`],
		stabilityClientUserId:
			requestHeaders[`x-${POWERED_BY}-stability-client-user-id`],
		stabilityClientVersion:
			requestHeaders[`x-${POWERED_BY}-stability-client-version`],
	};

	const azureAiInferenceConfig = {
		azureApiVersion: requestHeaders[`x-${POWERED_BY}-azure-api-version`],
		azureEndpointName: requestHeaders[`x-${POWERED_BY}-azure-endpoint-name`],
		azureFoundryUrl: requestHeaders[`x-${POWERED_BY}-azure-foundry-url`],
		azureAdToken: requestHeaders[`x-${POWERED_BY}-azure-ad-token`],
		azureAuthMode: requestHeaders[`x-${POWERED_BY}-azure-auth-mode`],
		azureManagedClientId:
			requestHeaders[`x-${POWERED_BY}-azure-managed-client-id`],
		azureEntraClientId: requestHeaders[`x-${POWERED_BY}-azure-entra-client-id`],
		azureEntraClientSecret:
			requestHeaders[`x-${POWERED_BY}-azure-entra-client-secret`],
		azureEntraTenantId:
			requestHeaders[`x-${POWERED_BY}-azure-entra-tenant-id`],
		azureEntraScope: requestHeaders[`x-${POWERED_BY}-azure-entra-scope`],
		azureExtraParameters: requestHeaders[`x-${POWERED_BY}-azure-extra-params`],
		anthropicVersion: requestHeaders[`x-${POWERED_BY}-anthropic-version`],
	};

	const awsConfig = {
		awsAccessKeyId: requestHeaders[`x-${POWERED_BY}-aws-access-key-id`],
		awsSecretAccessKey: requestHeaders[`x-${POWERED_BY}-aws-secret-access-key`],
		awsSessionToken: requestHeaders[`x-${POWERED_BY}-aws-session-token`],
		awsRegion: requestHeaders[`x-${POWERED_BY}-aws-region`],
		awsRoleArn: requestHeaders[`x-${POWERED_BY}-aws-role-arn`],
		awsAuthType: requestHeaders[`x-${POWERED_BY}-aws-auth-type`],
		awsExternalId: requestHeaders[`x-${POWERED_BY}-aws-external-id`],
		awsS3Bucket: requestHeaders[`x-${POWERED_BY}-aws-s3-bucket`],
		awsS3ObjectKey:
			requestHeaders[`x-${POWERED_BY}-aws-s3-object-key`] ||
			requestHeaders[`x-${POWERED_BY}-provider-file-name`],
		awsBedrockModel:
			requestHeaders[`x-${POWERED_BY}-aws-bedrock-model`] ||
			requestHeaders[`x-${POWERED_BY}-provider-model`],
		awsServerSideEncryption:
			requestHeaders[`x-${POWERED_BY}-amz-server-side-encryption`],
		awsServerSideEncryptionKMSKeyId:
			requestHeaders[
				`x-${POWERED_BY}-amz-server-side-encryption-aws-kms-key-id`
			],
		anthropicBeta:
			requestHeaders[`x-${POWERED_BY}-anthropic-beta`] ||
			requestHeaders[`anthropic-beta`],
		anthropicVersion:
			requestHeaders[`x-${POWERED_BY}-anthropic-version`] ||
			requestHeaders[`anthropic-version`],
	};

	const sagemakerConfig = {
		amznSagemakerCustomAttributes:
			requestHeaders[`x-${POWERED_BY}-amzn-sagemaker-custom-attributes`],
		amznSagemakerTargetModel:
			requestHeaders[`x-${POWERED_BY}-amzn-sagemaker-target-model`],
		amznSagemakerTargetVariant:
			requestHeaders[`x-${POWERED_BY}-amzn-sagemaker-target-variant`],
		amznSagemakerTargetContainerHostname:
			requestHeaders[
				`x-${POWERED_BY}-amzn-sagemaker-target-container-hostname`
			],
		amznSagemakerInferenceId:
			requestHeaders[`x-${POWERED_BY}-amzn-sagemaker-inference-id`],
		amznSagemakerEnableExplanations:
			requestHeaders[`x-${POWERED_BY}-amzn-sagemaker-enable-explanations`],
		amznSagemakerInferenceComponent:
			requestHeaders[`x-${POWERED_BY}-amzn-sagemaker-inference-component`],
		amznSagemakerSessionId:
			requestHeaders[`x-${POWERED_BY}-amzn-sagemaker-session-id`],
		amznSagemakerModelName:
			requestHeaders[`x-${POWERED_BY}-amzn-sagemaker-model-name`],
	};

	const workersAiConfig = {
		workersAiAccountId: requestHeaders[`x-${POWERED_BY}-workers-ai-account-id`],
	};

	const openAiConfig = {
		openaiOrganization: requestHeaders[`x-${POWERED_BY}-openai-organization`],
		openaiProject: requestHeaders[`x-${POWERED_BY}-openai-project`],
		openaiBeta:
			requestHeaders[`x-${POWERED_BY}-openai-beta`] ||
			requestHeaders[`openai-beta`],
	};

	const huggingfaceConfig = {
		huggingfaceBaseUrl: requestHeaders[`x-${POWERED_BY}-huggingface-base-url`],
	};

	const vertexConfig: Record<string, any> = {
		vertexProjectId: requestHeaders[`x-${POWERED_BY}-vertex-project-id`],
		vertexRegion: requestHeaders[`x-${POWERED_BY}-vertex-region`],
		vertexStorageBucketName:
			requestHeaders[`x-${POWERED_BY}-vertex-storage-bucket-name`],
		filename: requestHeaders[`x-${POWERED_BY}-provider-file-name`],
		vertexModelName: requestHeaders[`x-${POWERED_BY}-provider-model`],
		vertexBatchEndpoint:
			requestHeaders[`x-${POWERED_BY}-provider-batch-endpoint`],
		anthropicBeta:
			requestHeaders[`x-${POWERED_BY}-anthropic-beta`] ||
			requestHeaders[`anthropic-beta`],
		anthropicVersion:
			requestHeaders[`x-${POWERED_BY}-anthropic-version`] ||
			requestHeaders[`anthropic-version`],
	};

	const fireworksConfig = {
		fireworksAccountId: requestHeaders[`x-${POWERED_BY}-fireworks-account-id`],
		fireworksFileLength: requestHeaders[`x-${POWERED_BY}-file-upload-size`],
	};

	const anthropicConfig = {
		anthropicBeta:
			requestHeaders[`x-${POWERED_BY}-anthropic-beta`] ||
			requestHeaders[`anthropic-beta`],
		anthropicVersion:
			requestHeaders[`x-${POWERED_BY}-anthropic-version`] ||
			requestHeaders[`anthropic-version`],
		anthropicApiKey: requestHeaders[`x-api-key`],
	};

	const vertexServiceAccountJson =
		requestHeaders[`x-${POWERED_BY}-vertex-service-account-json`];

	if (vertexServiceAccountJson) {
		try {
			vertexConfig.vertexServiceAccountJson = JSON.parse(
				vertexServiceAccountJson,
			);
		} catch (e) {
			vertexConfig.vertexServiceAccountJson = null;
		}
	}

	const cortexConfig = {
		snowflakeAccount: requestHeaders[`x-${POWERED_BY}-snowflake-account`],
	};

	const oracleConfig = {
		oracleApiVersion: requestHeaders[`x-${POWERED_BY}-oracle-api-version`],
		oracleRegion: requestHeaders[`x-${POWERED_BY}-oracle-region`],
		oracleCompartmentId:
			requestHeaders[`x-${POWERED_BY}-oracle-compartment-id`],
		oracleServingMode: requestHeaders[`x-${POWERED_BY}-oracle-serving-mode`],
		oracleTenancy: requestHeaders[`x-${POWERED_BY}-oracle-tenancy`],
		oracleUser: requestHeaders[`x-${POWERED_BY}-oracle-user`],
		oracleFingerprint: requestHeaders[`x-${POWERED_BY}-oracle-fingerprint`],
		oraclePrivateKey: requestHeaders[`x-${POWERED_BY}-oracle-private-key`],
		oracleKeyPassphrase:
			requestHeaders[`x-${POWERED_BY}-oracle-key-passphrase`],
	};

	const defaultsConfig = {
		input_guardrails: requestHeaders[`x-portkey-default-input-guardrails`]
			? JSON.parse(requestHeaders[`x-portkey-default-input-guardrails`])
			: [],
		output_guardrails: requestHeaders[`x-portkey-default-output-guardrails`]
			? JSON.parse(requestHeaders[`x-portkey-default-output-guardrails`])
			: [],
	};

	if (requestHeaders[`x-${POWERED_BY}-config`]) {
		let parsedConfigJson = JSON.parse(
			requestHeaders[`x-${POWERED_BY}-config`],
		);
		parsedConfigJson.default_input_guardrails = defaultsConfig.input_guardrails;
		parsedConfigJson.default_output_guardrails =
			defaultsConfig.output_guardrails;

		if (!parsedConfigJson.provider && !parsedConfigJson.targets) {
			parsedConfigJson.provider = requestHeaders[`x-${POWERED_BY}-provider`];
			parsedConfigJson.api_key = requestHeaders["authorization"]?.replace(
				"Bearer ",
				"",
			);

			if (parsedConfigJson.provider === AZURE_OPEN_AI) {
				parsedConfigJson = {
					...parsedConfigJson,
					...azureConfig,
				};
			}

			if (
				parsedConfigJson.provider === BEDROCK ||
				parsedConfigJson.provider === SAGEMAKER
			) {
				parsedConfigJson = {
					...parsedConfigJson,
					...awsConfig,
				};
			}

			if (parsedConfigJson.provider === SAGEMAKER) {
				parsedConfigJson = {
					...parsedConfigJson,
					...sagemakerConfig,
				};
			}

			if (parsedConfigJson.provider === WORKERS_AI) {
				parsedConfigJson = {
					...parsedConfigJson,
					...workersAiConfig,
				};
			}

			if (parsedConfigJson.provider === OPEN_AI) {
				parsedConfigJson = {
					...parsedConfigJson,
					...openAiConfig,
				};
			}

			if (parsedConfigJson.provider === HUGGING_FACE) {
				parsedConfigJson = {
					...parsedConfigJson,
					...huggingfaceConfig,
				};
			}

			if (parsedConfigJson.provider === GOOGLE_VERTEX_AI) {
				parsedConfigJson = {
					...parsedConfigJson,
					...vertexConfig,
				};
			}

			if (parsedConfigJson.provider === FIREWORKS_AI) {
				parsedConfigJson = {
					...parsedConfigJson,
					...fireworksConfig,
				};
			}

			if (parsedConfigJson.provider === AZURE_AI_INFERENCE) {
				parsedConfigJson = {
					...parsedConfigJson,
					...azureAiInferenceConfig,
				};
			}
			if (parsedConfigJson.provider === ANTHROPIC) {
				parsedConfigJson = {
					...parsedConfigJson,
					...anthropicConfig,
				};
			}
			if (parsedConfigJson.provider === STABILITY_AI) {
				parsedConfigJson = {
					...parsedConfigJson,
					...stabilityAiConfig,
				};
			}

			if (parsedConfigJson.provider === CORTEX) {
				parsedConfigJson = {
					...parsedConfigJson,
					...cortexConfig,
				};
			}
			if (parsedConfigJson.provider === ORACLE) {
				parsedConfigJson = {
					...parsedConfigJson,
					...oracleConfig,
				};
			}
		}
		return convertKeysToCamelCase(parsedConfigJson, [
			"override_params",
			"params",
			"checks",
			"vertex_service_account_json",
			"vertexServiceAccountJson",
			"conditions",
			"input_guardrails",
			"output_guardrails",
			"default_input_guardrails",
			"default_output_guardrails",
			"integrationModelDetails",
			"integrationDetails",
			"virtualKeyDetails",
			"cb_config",
		]) as any;
	}

	return {
		provider: requestHeaders[`x-${POWERED_BY}-provider`],
		apiKey: requestHeaders["authorization"]?.replace("Bearer ", ""),
		defaultInputGuardrails: defaultsConfig.input_guardrails,
		defaultOutputGuardrails: defaultsConfig.output_guardrails,
		...(requestHeaders[`x-${POWERED_BY}-provider`] === AZURE_OPEN_AI &&
			azureConfig),
		...([BEDROCK, SAGEMAKER].includes(
			requestHeaders[`x-${POWERED_BY}-provider`],
		) && awsConfig),
		...(requestHeaders[`x-${POWERED_BY}-provider`] === SAGEMAKER &&
			sagemakerConfig),
		...(requestHeaders[`x-${POWERED_BY}-provider`] === WORKERS_AI &&
			workersAiConfig),
		...(requestHeaders[`x-${POWERED_BY}-provider`] === GOOGLE_VERTEX_AI &&
			vertexConfig),
		...(requestHeaders[`x-${POWERED_BY}-provider`] === AZURE_AI_INFERENCE &&
			azureAiInferenceConfig),
		...(requestHeaders[`x-${POWERED_BY}-provider`] === OPEN_AI && openAiConfig),
		...(requestHeaders[`x-${POWERED_BY}-provider`] === ANTHROPIC &&
			anthropicConfig),
		...(requestHeaders[`x-${POWERED_BY}-provider`] === HUGGING_FACE &&
			huggingfaceConfig),
		mistralFimCompletion:
			requestHeaders[`x-${POWERED_BY}-mistral-fim-completion`],
		...(requestHeaders[`x-${POWERED_BY}-provider`] === STABILITY_AI &&
			stabilityAiConfig),
		...(requestHeaders[`x-${POWERED_BY}-provider`] === FIREWORKS_AI &&
			fireworksConfig),
		...(requestHeaders[`x-${POWERED_BY}-provider`] === CORTEX && cortexConfig),
		...(requestHeaders[`x-${POWERED_BY}-provider`] === ORACLE && oracleConfig),
	};
}