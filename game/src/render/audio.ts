import type { ActorState } from '../types';
// Entirely synthesized ambience. No ripped radio, music or trailer audio.
export class GameAudio {
  private context?:AudioContext;private master?:GainNode;private engine?:OscillatorNode;private engineGain?:GainNode;private windGain?:GainNode;private filter?:BiquadFilterNode;private step=0;
  async start(){
    if(this.context){await this.context.resume();return;}
    const ctx=new AudioContext();this.context=ctx;this.master=ctx.createGain();this.master.gain.value=.32;this.master.connect(ctx.destination);
    const engine=ctx.createOscillator();engine.type='sawtooth';engine.frequency.value=36;this.engine=engine;
    this.filter=ctx.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=240;this.engineGain=ctx.createGain();this.engineGain.gain.value=0;
    engine.connect(this.filter).connect(this.engineGain).connect(this.master);engine.start();
    const noise=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),a=noise.getChannelData(0);let last=0;
    for(let i=0;i<a.length;i++){last=(last+(Math.random()*2-1)*.035)/1.015;a[i]=last;}
    const source=ctx.createBufferSource();source.buffer=noise;source.loop=true;const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=640;this.windGain=ctx.createGain();this.windGain.gain.value=.05;source.connect(low).connect(this.windGain).connect(this.master);source.start();
    await ctx.resume();
  }
  enabled(on:boolean){if(this.master&&this.context)this.master.gain.setTargetAtTime(on?.32:0,this.context.currentTime,.15);}
  update(dt:number,actor:ActorState){
    if(!this.context||!this.engine||!this.engineGain||!this.filter)return;
    const t=this.context.currentTime,speed=Math.abs(actor.speed);
    this.engine.frequency.setTargetAtTime(34+speed*2.6,t,.08);this.engineGain.gain.setTargetAtTime(actor.driving?.08+Math.min(.07,speed*.002):0,t,.12);
    this.filter.frequency.setTargetAtTime(150+speed*18,t,.15);this.windGain?.gain.setTargetAtTime(.05+speed*.0012,t,.3);
    this.step+=dt*speed;
    if(!actor.driving&&actor.grounded&&speed>.5&&this.step>.95){this.step=0;this.tone(75,.035,.055);}
  }
  tone(frequency=620,duration=.12,volume=.07){
    if(!this.context||!this.master)return;const c=this.context,o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=frequency;g.gain.setValueAtTime(volume,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration);o.connect(g).connect(this.master);o.start();o.stop(c.currentTime+duration);o.onended=()=>{o.disconnect();g.disconnect();};
  }
  suspend(){this.context?.suspend().catch(()=>{});}
  dispose(){this.context?.close().catch(()=>{});}
}
