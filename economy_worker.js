// Large catch-up jobs run without rendering, DOM, storage or multiplayer access.
importScripts(
  "industrial/catalog-data.js?v=3403",
  "industrial/registry.js?v=3403",
  "industrial/player-materials-data.js?v=3403",
  "industrial/research-data.js?v=3403",
  "industrial/progression.js?v=3403",
  "economy_model.js?v=3404",
);
self.onmessage = ({ data }) => {
  try {
    const { state, defs, target, online } = data;
    let result,
      steps = 0,
      evaluations = 0;
    do {
      result = mapGameEconomyModel.advance(state, target, online, defs, {
        maxEvaluations: 64,
      });
      steps += result.steps;
      evaluations += result.evaluations;
    } while (!result.complete);
    self.postMessage({
      state,
      result: { steps, evaluations, complete: true },
      summaryOnline: mapGameEconomyModel.summary(state, defs, true),
    });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
