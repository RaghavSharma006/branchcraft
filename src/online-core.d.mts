export type OnlineInput={repository:string;kind:'repository'|'branches'|'branch'|'commits'|'commit';page?:number;sha?:string;branch?:string};
export type OnlineCommit={sha:string;parents:{sha:string}[];commit:{message:string;author:{name:string;email?:string;date:string};committer?:{name:string;date:string};verification?:{verified:boolean;reason:string}};author?:{login:string}|null;stats?:{additions:number;deletions:number;total:number};files?:{sha:string;filename:string;previous_filename?:string;status:string;additions:number;deletions:number;patch?:string}[]};
export function parseRepository(input:string):string;
export function onlineEndpoint(input:OnlineInput):string;
export function readPublic(input:OnlineInput,fetcher?:typeof fetch):Promise<any>;
export function historyLayout(commits:OnlineCommit[]):{nodes:(OnlineCommit & {lane:number;y:number})[];lanes:number};
