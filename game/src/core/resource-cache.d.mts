export class ResourceCache<T> {
 constructor(dispose:(resource:T)=>void);
 acquire(key:string,factory:()=>T):T;
 release(resource:T):boolean;
 readonly size:number;
 clear():void;
}
