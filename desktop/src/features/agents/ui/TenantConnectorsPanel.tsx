import type React from "react";
import { useState, useEffect } from "react";
import {
  type ConnectorConfig,
  tenantConnectorsManager,
} from "../tenantConnectors";

interface Props {
  tenantId: string;
}

export const TenantConnectorsPanel: React.FC<Props> = ({ tenantId }) => {
  const [connectors, setConnectors] = useState<ConnectorConfig[]>([]);

  useEffect(() => {
    const loadConnectors = async () => {
      const data = await tenantConnectorsManager.getConnectors(tenantId);
      setConnectors(data);
    };
    loadConnectors();
  }, [tenantId]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-xl font-bold">Tenant Connectors</h2>
      <div className="flex flex-col gap-2">
        {connectors.map((c) => (
          <div key={c.id} className="border p-2 rounded">
            <div>Provider: {c.provider}</div>
            <div>ID: {c.id}</div>
          </div>
        ))}
        {connectors.length === 0 && (
          <div className="text-gray-500">No connectors configured.</div>
        )}
      </div>
    </div>
  );
};
