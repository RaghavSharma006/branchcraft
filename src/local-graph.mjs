// Pure name-based colors: no storage, no dependency on HEAD or lane position.
export function branchColor(name,remote=false){
 const key=remote?name.slice(name.indexOf('/')+1):name;
 if(key==='main')return '#b3a0ff';if(key==='master')return '#69d9b3';
 let hash=2166136261;for(const char of key)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
 return 'hsl('+hash%360+' 65% 72%)';
}
// Layout follows Git's parent links, never timestamps or branch-name guesses.
export function layout(repo) {
  const byHash = new Map(repo.commits.map(commit => [commit.hash, commit]));
  const branches = [...repo.branches].sort((a, b) =>
    Number(!['main','master'].includes(a.name)) - Number(!['main','master'].includes(b.name))
    || Number(a.remote) - Number(b.remote) || a.name.localeCompare(b.name));
  const lanes = new Map(), laneColors=[];
  let laneCount = 0;
  function followFirstParent(hash,color=branchColor(hash)) {
    let used = false;
    while (byHash.has(hash) && !lanes.has(hash)) {
      lanes.set(hash, laneCount); used = true;
      hash = byHash.get(hash).parents[0];
    }
    if (used) {laneColors[laneCount]=color;laneCount++;}
  }
  // Color ownership is independent of the selected branch.
  for (const branch of branches) followFirstParent(branch.hash,branchColor(branch.name,branch.remote));

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
  // Keep every connected history in one contiguous band. Otherwise an edge
  // between related branches can visually cut through an unrelated root.
  const laneGroups=new Map([...lanes].map(([hash,lane])=>[lane,groupIds.get(group(hash))]));
  const laneOrder=[...laneGroups.keys()].sort((a,b)=>laneGroups.get(a)-laneGroups.get(b)||a-b);
  const remap=new Map(laneOrder.map((old,index)=>[old,index]));
  const oldColors=laneColors.slice();
  for(const [hash,lane] of lanes)lanes.set(hash,remap.get(lane));
  laneOrder.forEach((old,index)=>{laneColors[index]=oldColors[old];});
  const laneLabels = Array.from({length:laneCount}, (_, lane) =>
    branches.filter(b => lanes.get(b.hash) === lane).map(b => b.name));
  const rowY = [];
  let nextY = 90;
  for (let lane = 0; lane < laneCount; lane++) {
    if(lane>0&&laneGroups.get(laneOrder[lane])!==laneGroups.get(laneOrder[lane-1]))nextY+=60;
    rowY.push(nextY);
    const maxRefs = Math.max(0, ...ordered.filter(c => lanes.get(c.hash) === lane)
      .map(c => branches.filter(b => b.hash === c.hash).length));
    const labelRows = Math.min(3, maxRefs);
    nextY += Math.max(118, (labelRows ? 72 + (labelRows - 1) * 16 : 51) + 36);
  }
  const nodes = ordered.map(commit => ({...commit,
    color:laneColors[lanes.get(commit.hash)], lane:lanes.get(commit.hash), component:groupIds.get(group(commit.hash)),
    x:80 + depth.get(commit.hash) * 140, y:rowY[lanes.get(commit.hash)],
    missingParents:commit.parents.filter(hash => !byHash.has(hash)),
  })).sort((a, b) => a.x - b.x || a.lane - b.lane || a.hash.localeCompare(b.hash));
  return {
    nodes, lanes:laneCount, laneLabels, components:groupOrder.length, incomplete,
    width:Math.max(600, ...nodes.map(node => node.x + 100)),
    height:Math.max(240, nextY + 12),
  };
}

