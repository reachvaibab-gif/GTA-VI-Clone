export class FixedClock {
  constructor(step=1/60,maxSteps=5){this.step=step;this.maxSteps=maxSteps;this.accumulator=0;this.dropped=0;}
  advance(dt,fn){
    const safe=Math.max(0,Math.min(Number.isFinite(dt)?dt:0,.25));
    this.accumulator+=safe;let n=0;
    while(this.accumulator>=this.step && n<this.maxSteps){fn(this.step);this.accumulator-=this.step;n++;}
    if(this.accumulator>=this.step){this.dropped+=this.accumulator;this.accumulator%=this.step;}
    return this.accumulator/this.step;
  }
  reset(){this.accumulator=0;}
}
