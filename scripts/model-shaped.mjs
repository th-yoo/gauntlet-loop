// ONE DEFINITION OF "this command names a model", for the refusals that need it.
//
// Issue #55. It existed byte-identical in three places: scripts/oracle-add.mjs, which
// refuses a mechanical grounding whose acceptance command names a model;
// scripts/constructed-verify.mjs, which refuses a probe whose command does; and
// test/containment.test.mjs, which used it to DISCOVER which files needed a spawn guard.
//
// The third one was the defect and is gone — containment now asks whether a binary is
// known inert, so the check and the thing it checks no longer share a rule and can
// disagree. What is left here are the two REFUSALS, which are genuinely the same rule
// serving the same purpose: a role settled by a model cannot audit a model. Two copies
// of one rule drift, and the drift is silent in the direction that matters — a name added
// to one refusal and not the other leaves the second one waving the command through.
//
// THIS LIST STILL ONLY KNOWS THE NAMES IT KNOWS, and that is not fixed by putting it in
// one file. It is why containment no longer depends on it: a guard whose reach is a list
// must not also be the thing that decides what the guard is for.
export const MODEL_SHAPED = /\b(claude|anthropic|openai|gpt|llm|ollama|gemini|codex|grok|llama|mistral|qwen|deepseek|copilot)\b/i

export const namesAModel = cmd => typeof cmd === 'string' && MODEL_SHAPED.test(cmd)
