export const dualAgentRunner = {
  runLocalDesktopAgent: async (task: string) => {
    console.log("Running local desktop agent via buzz-acp/ember-acp", task);
  },
  runServerEnterpriseAgent: async (task: string) => {
    const serverUrl = "http://154.26.132.120";
    console.log(`Running server enterprise agent at ${serverUrl}`, task);
  },
};
