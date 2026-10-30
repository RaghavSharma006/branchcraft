// Layout follows Git's parent links, never timestamps or branch-name guesses.
export function layout(repo) {
  const byHash = new Map(repo.commits.map(commit => [commit.hash, commit]));
  const branches = [...repo.branches].sort((a, b) =>
    Number(a.name !== repo.current || a.remote) - Number(b.name !== repo.current || b.remote)
    || Number(a.remote) - Number(b.remote) || a.name.localeCompare(b.name));
  const lanes = new Map();
  let laneCount = 0;
  function followFirstParent(hash) {
    let used = false;
    while (byHash.has(hash) && !lanes.has(hash)) {
      lanes.set(hash, laneCount); used = true;
      hash = byHash.get(hash).parents[0];
    }
    if (used) laneCount++;
  }
  // Detached HEAD also owns the first lane. Other refs at this commit share it.
  followFirstParent(repo.head);
  for (const branch of branches) followFirstParent(branch.hash);

  const children = new Map([...byHash.keys()].map(hash => [hash, []]));
  const parentCounts = new Map();
  const depth = new Map();
  const connected = new Map([...byHash.keys()].map(hash => [hash, hash]));
  function group(hash) {
    while (connected.get(hash) !== hash) hash = connected.get(hash);
    return hash;
  }
  let incomplete = false;
  for (const commit of byHash.values()) {
    const known = [...new Set(commit.parents.filter(hash => byHash.has(hash)))];
    parentCounts.set(commit.hash, known.length);
    incomplete ||= known.length < commit.parents.length;
    for (const parent of known) {
      children.get(parent).push(commit.hash);
      connected.set(group(commit.hash), group(parent));
    }
  }
  const ready = [...byHash.keys()].filter(hash => parentCounts.get(hash) === 0).sort();
  const ordered = [];
  while (ready.length) {
    const hash = ready.shift(), commit = byHash.get(hash);
    depth.set(hash, Math.max(-1, ...commit.parents.filter(p => depth.has(p)).map(p => depth.get(p))) + 1);
    ordered.push(commit);
    for (const child of children.get(hash)) {
      parentCounts.set(child, parentCounts.get(child) - 1);
      if (!parentCounts.get(child)) { ready.push(child); ready.sort(); }
    }
  }
  // Git cannot contain cycles; reject malformed input rather than draw false edges.
  if (ordered.length !== byHash.size) throw Error('Commit history contains a parent cycle.');
  for (const commit of ordered.slice().reverse()) followFirstParent(commit.hash);

  const groupOrder = [...new Set([...lanes.keys()].map(group))];
  const groupIds = new Map(groupOrder.map((hash, index) => [hash, index]));
  const laneLabels = Array.from({length:laneCount}, (_, lane) =>
    branches.filter(b => lanes.get(b.hash) === lane).map(b => b.name));
  const rowY = [];
  let nextY = 90;
  for (let lane = 0; lane < laneCount; lane++) {
    rowY.push(nextY);
    const maxRefs = Math.max(0, ...ordered.filter(c => lanes.get(c.hash) === lane)
      .map(c => branches.filter(b => b.hash === c.hash).length));
    const labelRows = Math.min(3, maxRefs);
    nextY += Math.max(118, (labelRows ? 72 + (labelRows - 1) * 16 : 51) + 36);
  }
  const nodes = ordered.map(commit => ({...commit,
    lane:lanes.get(commit.hash), component:groupIds.get(group(commit.hash)),
    x:80 + depth.get(commit.hash) * 140, y:rowY[lanes.get(commit.hash)],
    missingParents:commit.parents.filter(hash => !byHash.has(hash)),
  })).sort((a, b) => a.x - b.x || a.lane - b.lane || a.hash.localeCompare(b.hash));
  return {
    nodes, lanes:laneCount, laneLabels, components:groupOrder.length, incomplete,
    width:Math.max(600, ...nodes.map(node => node.x + 100)),
    height:Math.max(240, nextY + 12),
  };
}
