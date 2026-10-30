import type {Commit, Repo} from './model';
export type GraphNode = Commit & {color:string;lane:number; component:number; x:number; y:number; missingParents:string[]};
export function layout(repo:Repo):{
  nodes:GraphNode[]; width:number; height:number; lanes:number;
  laneLabels:string[][]; components:number; incomplete:boolean;
};

export function branchColor(name:string,remote?:boolean):string;
