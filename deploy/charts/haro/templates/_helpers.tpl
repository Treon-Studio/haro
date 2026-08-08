{{/* Standard naming/labels helpers. */}}

{{- define "Haro.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "Haro.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "Haro.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "Haro.labels" -}}
helm.sh/chart: {{ include "haro.chart" . }}
{{ include "haro.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: Haro
{{- end -}}

{{- define "Haro.selectorLabels" -}}
app.kubernetes.io/name: {{ include "haro.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/* Relay-specific selector: scopes the relay Deployment + Service so they do
     not also match the quickstart MinIO pods, which share the base
     selectorLabels but carry their own component label. */}}
{{- define "Haro.relaySelectorLabels" -}}
{{ include "haro.selectorLabels" . }}
app.kubernetes.io/component: relay
{{- end -}}

{{- define "Haro.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "haro.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{- define "Haro.image" -}}
{{- $tag := default .Chart.AppVersion .Values.image.tag -}}
{{- printf "%s:%s" .Values.image.repository $tag -}}
{{- end -}}

{{/*
Name of the chart-managed Secret holding relay-identity material and any
chart-composed connection strings.
*/}}
{{- define "Haro.chartSecretName" -}}
{{- printf "%s-relay" (include "haro.fullname" .) -}}
{{- end -}}

{{/*
The Secret name the relay should pull env from. If the operator supplied
secrets.existingSecret, use that. Otherwise use the chart-managed one.
*/}}
{{- define "Haro.envSecretName" -}}
{{- if .Values.secrets.existingSecret -}}
{{- .Values.secrets.existingSecret -}}
{{- else -}}
{{- include "haro.chartSecretName" . -}}
{{- end -}}
{{- end -}}

{{/* Host derived from relayUrl, used as ingress default + media domain. */}}
{{- define "Haro.relayHost" -}}
{{- $url := required "relayUrl is required: set --set relayUrl=wss://your.domain" .Values.relayUrl -}}
{{- $stripped := $url | replace "wss://" "" | replace "ws://" "" | replace "https://" "" | replace "http://" "" -}}
{{- first (splitList "/" $stripped) -}}
{{- end -}}

{{/* Default media base URL: https://<host>/media derived from relayUrl. */}}
{{- define "Haro.mediaBaseUrl" -}}
{{- if .Values.mediaBaseUrl -}}
{{- .Values.mediaBaseUrl -}}
{{- else -}}
{{- printf "https://%s/media" (include "haro.relayHost" .) -}}
{{- end -}}
{{- end -}}

{{/* Quickstart-only in-cluster service hostnames (eval profile). */}}
{{- define "Haro.minioFullname" -}}
{{- printf "%s-minio" (include "haro.fullname" .) -}}
{{- end -}}

{{/* In-cluster MinIO endpoint, used when minio.enabled and s3.endpoint unset. */}}
{{- define "Haro.minioEndpoint" -}}
{{- printf "http://%s.%s.svc.cluster.local:9000" (include "haro.minioFullname" .) .Release.Namespace -}}
{{- end -}}

{{/* Minimum number of relay replicas the release can run. */}}
{{- define "Haro.minimumReplicas" -}}
{{- if .Values.autoscaling.enabled -}}
{{- .Values.autoscaling.minReplicas -}}
{{- else -}}
{{- .Values.replicaCount -}}
{{- end -}}
{{- end -}}

{{/* Effective huddle-audio availability. Nil means safe chart default: on for
     one replica, off for multi-pod until an SFU/shared-room story exists. */}}
{{- define "Haro.huddleAudioAvailable" -}}
{{- if kindIs "invalid" .Values.relay.huddleAudioAvailable -}}
{{- if gt (include "haro.minimumReplicas" . | int) 1 -}}false{{- else -}}true{{- end -}}
{{- else -}}
{{- .Values.relay.huddleAudioAvailable -}}
{{- end -}}
{{- end -}}

{{/* Effective S3 endpoint: explicit s3.endpoint wins, else bundled MinIO. */}}
{{- define "Haro.s3Endpoint" -}}
{{- if .Values.s3.endpoint -}}
{{- .Values.s3.endpoint -}}
{{- else if .Values.minio.enabled -}}
{{- include "haro.minioEndpoint" . -}}
{{- end -}}
{{- end -}}

{{- define "Haro.pairingRelaySelectorLabels" -}}
{{ include "haro.selectorLabels" . }}
app.kubernetes.io/component: pairing-relay
{{- end -}}
