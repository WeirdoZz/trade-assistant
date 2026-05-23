function createStartupTasks(tasks = []) {
  async function run() {
    await Promise.all(tasks.map(async (task) => {
      try {
        await task.run();
      } catch (error) {
        console.warn(`${task.name} startup task failed:`, error.message);
      }
    }));
  }

  return {
    run
  };
}

function createRefreshUsSymbolsTask({ symbolStore, notifyUpdated }) {
  return {
    name: "US symbols refresh",
    async run() {
      const symbols = await symbolStore.refreshSymbols();
      notifyUpdated?.(symbols);
    }
  };
}

module.exports = {
  createStartupTasks,
  createRefreshUsSymbolsTask
};
