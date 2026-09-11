export class Platform {
  constructor(kind,host=globalThis){this.host=host;this.kind=kind;this.sdk=host.ytgame;this.youtube=!!this.sdk?.IN_PLAYABLES_ENV;this.loaded=false;this.paused=false;this.queue=Promise.resolve();this.onState=()=>{};this.onSave=()=>{};this.audio=true;}
  firstFrame(){if(this.youtube)this.sdk.game.firstFrameReady();}
  async init(){
    if(this.youtube){
      this.audio=this.sdk.system.isAudioEnabled();
      this.sdk.system.onAudioEnabledChange(enabled=>{this.audio=enabled;this.onState();});
      this.sdk.system.onPause(()=>{this.paused=true;this.onState();});
      this.sdk.system.onResume(()=>{this.paused=false;this.onState();});
      this.lang=await this.sdk.system.getLanguage();
      const raw=await this.sdk.game.loadData();this.data=raw?JSON.parse(raw):null;
    }else{
      this.lang=this.host.navigator?.language||'en';
      try{const raw=this.host.localStorage.getItem(`cat-${this.kind}-v1`);this.data=raw?JSON.parse(raw):null;}catch(error){this.storageError=error;this.data=null;}
    }
    if(this.data&&this.data.version!==1)throw Error('Unsupported save version');
    this.loaded=true;return this.data;
  }
  ready(){if(this.youtube)this.sdk.game.gameReady();}
  save(data){
    if(!this.loaded)return Promise.reject(Error('Save before load'));
    const raw=JSON.stringify(data);if(raw.length>64000)return Promise.reject(Error('Save too large'));
    this.queue=this.queue.catch(()=>{}).then(async()=>{try{if(this.youtube)await this.sdk.game.saveData(raw);else {if(this.storageError)throw this.storageError;this.host.localStorage.setItem(`cat-${this.kind}-v1`,raw);}this.onSave(true);}catch(error){this.onSave(false);if(this.youtube)this.sdk.health.logWarning();}});return this.queue;
  }
  score(value){if(this.youtube&&this.loaded&&!this.paused)this.sdk.engagement.sendScore({value}).catch(()=>this.sdk.health.logWarning());}
}
