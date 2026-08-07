export interface ObsidianNote {
  path: string;
  content: string;
  frontmatter: Record<string, unknown>;
}

export class ObsidianSyncEngine {
  private vaultPath: string;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
  }

  async readNote(path: string): Promise<ObsidianNote | null> {
    // Mock implementation for reading local markdown file
    return {
      path,
      content: "# Mock Note",
      frontmatter: {},
    };
  }

  async writeNote(
    path: string,
    content: string,
    frontmatter?: Record<string, unknown>,
  ): Promise<void> {
    // Mock implementation for writing local markdown file
    console.log(
      `Writing note to ${this.vaultPath}/${path}`,
      content,
      frontmatter,
    );
  }

  async indexVault(): Promise<string[]> {
    // Mock implementation for indexing `.md` files
    return [];
  }
}
