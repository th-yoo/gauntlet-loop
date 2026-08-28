// THE BINARY NAMES THE MACHINERY IS MEASURED AGAINST, in one place because two
// checks need the same set and for opposite reasons.
//
// `test/spawn-discovery.test.mjs` uses them to ask whether CONTAINMENT finds an
// unguarded spawner whatever its binary is called. Issue #55 moved that check off
// a name list entirely — a binary is suspicious unless vouched for — and these
// names are how that was measured: 7 caught, 6 missed, and the six differed from
// the seven in nothing but the name.
//
// `test/oracle.test.mjs` uses them to ask the other question, which is issue #57:
// the REFUSALS still run off a list. `scripts/model-shaped.mjs` is one regex of
// fourteen names, and three sites refuse a model-backed command through it —
// oracle-add at write time, constructed-verify on a probe, oracle-report when it
// re-runs a stored command. Dropping `deepseek` from that regex passed the entire
// suite: the refusal path was pinned and the REACH of the list was not.
//
// WHY THIS IS NOT A SECOND COPY OF THE LIST. The crossing has to anchor on
// something the subject does not control. A test that derived its cases FROM
// `MODEL_SHAPED` could never notice a name leaving it — the case would leave with
// it. So the battery is an oracle held apart from the regex, and it carries an
// arm the regex must NOT match, without which the check passes by refusing
// everything.
//
// SPLIT SO THE LITERAL NEVER SITS BESIDE A SPAWN CALL. This matters more under
// by-behaviour discovery, not less: containment flags any spawn call whose binary
// it cannot vouch for, so a bare literal in a file that also spawns would make
// that file a spawner and demand a GAUNTLET_SUITE guard in it. Nothing here
// spawns, and the splitting is kept anyway so the names can move to a file that
// does.

export const ON_THE_OLD_LIST = ['clau' + 'de', 'anthro' + 'pic', 'open' + 'ai', 'g' + 'pt', 'l' + 'lm', 'olla' + 'ma', 'gemi' + 'ni']
export const ADDED_LATER = ['cod' + 'ex', 'gr' + 'ok', 'lla' + 'ma', 'mist' + 'ral', 'qw' + 'en', 'deep' + 'seek']

// Names no registry holds and none ever will. A fix that only widens a list fails
// here, and so does a refusal that has stopped discriminating.
export const ON_NO_LIST_AT_ALL = ['nimb' + 'usrun', 'aardv' + 'ark', 'zeph' + 'yrctl', 'quillo' + 'n']

export const EVERY_BINARY = [...ON_THE_OLD_LIST, ...ADDED_LATER, ...ON_NO_LIST_AT_ALL]

// The names a model-backed command may be built from — both arms that a refusal
// is supposed to catch. `ADDED_LATER` is the half that was invisible until #55.
export const RUNNERS = [...ON_THE_OLD_LIST, ...ADDED_LATER]
