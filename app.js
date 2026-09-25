/* ===== 开屏动画 ===== */
(function(){
  const splash=document.querySelector('#splash');
  const percentEl=document.querySelector('#splashPercent');
  if(!splash)return;
  // 百分比滚动
  let p=0;
  const timer=setInterval(()=>{
    p+=Math.ceil((100-p)*0.15)+1;
    if(p>=100){p=100;clearInterval(timer);}
    if(percentEl)percentEl.textContent=p+'%';
  },40);
  // 4秒后淡出（动画3秒+署名展示1秒）
  setTimeout(()=>{
    splash.classList.add('hide');
    setTimeout(()=>{splash.style.display='none';},700);
  },4000);
})();

const audio=document.querySelector('#audio');
const playBtn=document.querySelector('#playBtn'), progress=document.querySelector('#progress');
const titleEl=document.querySelector('#nowTitle'), timeEl=document.querySelector('#time');
const lyricsTrack=document.querySelector('#lyricsTrack');
const lyricsViewport=document.querySelector('.lyricsViewport');
const localListEl=document.querySelector('#localList');
const filterInput=document.querySelector('#filterInput');
const playlistPanel=document.querySelector('#playlistPanel');
const playlistOverlay=document.querySelector('#playlistOverlay');
const singerScroll=document.querySelector('#singerScroll');
const playlistSongs=document.querySelector('#playlistSongs');
const closePlaylistBtn=document.querySelector('#closePlaylist');
const playlistBtn=document.querySelector('#playlistBtn');
let currentSinger=null;
const controls=document.querySelector('#controls');
const stage=document.querySelector('#stage');
const searchPanel=document.querySelector('#searchPanel');
const appEl=document.querySelector('#app');
const logoBg=document.querySelector('#logoBg');
const countdownDisplay=document.querySelector('#countdownDisplay');
const seekFeedback=document.querySelector('#seekFeedback');
/* ===== 互动模式 ===== */
let interactiveMode=false;
let interactiveData={};
fetch('data/interactive.json').then(r=>r.json()).then(d=>{interactiveData=d;}).catch(()=>{});
function getInteractiveRole(songKey, time){
  const cfg=interactiveData[songKey];
  if(!cfg)return null;
  for(const seg of cfg){
    if(time>=seg.s-0.5&&time<seg.e)return seg.r;
  }
  return null;
}
let current={title:'',lyrics:[]}, offset=0, localSongs=[];
let virtTime=0, virtTimer=null, virtPlaying=false;
// 更新结束画面时间
setInterval(()=>{
  const now=new Date();
  const h=String(now.getHours()).padStart(2,'0');
  const m=String(now.getMinutes()).padStart(2,'0');
  const el=document.querySelector('#endTime');
  if(el)el.textContent=h+':'+m;
  const days=['日','一','二','三','四','五','六'];
  const dEl=document.querySelector('#endDate');
  if(dEl)dEl.textContent=now.getFullYear()+'年'+(now.getMonth()+1)+'月'+now.getDate()+'日 星期'+days[now.getDay()];
},1000);
// 更新结束画面时间
setInterval(()=>{
  const now=new Date();
  const h=String(now.getHours()).padStart(2,'0');
  const m=String(now.getMinutes()).padStart(2,'0');
  document.querySelector('#endTime').textContent=h+':'+m;
  const days=['日','一','二','三','四','五','六'];
  document.querySelector('#endDate').textContent=now.getFullYear()+'年'+(now.getMonth()+1)+'月'+now.getDate()+'日 星期'+days[now.getDay()];
},1000);
let hideTimer=null, countdownSec=0, countdownTimer=null, seekFbTimer=null;
let wakeLock=null;

/* ===== 全屏歌名渐隐 ===== */
const titleSplash=document.querySelector('#titleSplash');
const titleSplashSong=document.querySelector('#titleSplashSong');
const titleSplashArtist=document.querySelector('#titleSplashArtist');
let titleSplashTimer=null;
let titleSplashEnabled=false;
let lastSplashTitle='';

/* ===== 我的歌单系统 ===== */
const myPlaylistBtn=document.querySelector('#myPlaylistBtn');
const myPlaylistPanel=document.querySelector('#myPlaylistPanel');
const myPlaylistOverlay=document.querySelector('#myPlaylistOverlay');
const closeMyPlaylistBtn=document.querySelector('#closeMyPlaylist');
const mpListView=document.querySelector('#mpListView');
const mpEditView=document.querySelector('#mpEditView');
const mpAddView=document.querySelector('#mpAddView');
const mpList=document.querySelector('#mpList');
const mpEditSongs=document.querySelector('#mpEditSongs');
const mpAddList=document.querySelector('#mpAddList');
const mpPlaylistName=document.querySelector('#mpPlaylistName');
const mpPlayMode=document.querySelector('#mpPlayMode');
const mpInterval=document.querySelector('#mpInterval');
const mpAddFilter=document.querySelector('#mpAddFilter');
const prevBtn=document.querySelector('#prevBtn');
const nextBtn=document.querySelector('#nextBtn');

let playlists=[];let isAutoPlaylistSwitch=false; // {id, name, songs:[{artist,title}], mode:'manual'|'auto', interval:3}
let currentPlaylist=null;
let currentSongIndex=0;
let playlistPlaying=false;
let autoNextTimer=null;
const STORAGE_KEY='juzi_playlists';

/* 设备检测：手机/电脑 */
(function detectDevice(){
  const ua=navigator.userAgent;
  const isMobile=/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
    || (navigator.maxTouchPoints>0 && window.innerWidth<1024);
  if(isMobile){
    document.documentElement.classList.add('is-mobile');
  }else{
    document.documentElement.classList.add('is-desktop');
  }
  // 所有设备默认收起搜索面板
  document.querySelector('#searchPanel').classList.add('hiddenBar');
})();

function fmt(t){if(!isFinite(t))return '00:00';let m=Math.floor(t/60),s=Math.floor(t%60);return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}
function parseLRC(text){
  const out=[]; const lines=text.split(/\r?\n/);
  for(const line of lines){
    const ms=[...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    const lyric=line.replace(/\[[^\]]+\]/g,'').trim();
    for(const m of ms){ if(lyric) out.push({t:Number(m[1])*60+Number(m[2]),text:lyric}); }
  }
  return out.sort((a,b)=>a.t-b.t);
}
function hasAudio(){return !!audio.src && audio.src!=='';}
function getCurTime(){return hasAudio()?audio.currentTime:virtTime;}
function getDuration(){
  if(hasAudio()&&isFinite(audio.duration))return audio.duration;
  if(current.lyrics.length)return current.lyrics[current.lyrics.length-1].t+3;
  return 0;
}

/* ===== 歌词渲染 + 平滑向上滚动 ===== */
function buildLyrics(){
  const viewH=lyricsViewport.clientHeight;
  if(!current.lyrics.length){
    lyricsTrack.innerHTML='<div class="lyricLine active"><img src="assets/logo.png" class="welcomeLogo" alt="桔子好声音"></div><div class="lyricSpacer" style="height:'+(viewH/2)+'px"></div>';
    lyricsTrack.style.transform='translateY('+(viewH/2-30)+'px)';
    return;
  }
  let html=current.lyrics.map((l,i)=>{
    let roleClass='';
    if(interactiveMode&&current.artist&&current.title){
      const role=getInteractiveRole(current.artist+' - '+current.title,l.t);
      if(role)roleClass=' role-'+role;
    }
    return `<div class="lyricLine${roleClass}" data-idx="${i}">${l.text}</div>`;
  }).join('');
  html+='<div class="lyricSpacer" style="height:'+(viewH/2)+'px"></div>';
  lyricsTrack.innerHTML=html;
}
function scrollLyrics(){
  if(!current.lyrics.length)return;
  const t=getCurTime()+offset;
  let idx=0;
  for(let i=0;i<current.lyrics.length;i++){if(current.lyrics[i].t<=t)idx=i;else break;}
  const lines=lyricsTrack.children;
  for(let i=0;i<lines.length;i++){
    if(!lines[i].classList.contains('lyricLine'))continue;
    lines[i].classList.remove('active','near');
    const lineIdx=Number(lines[i].dataset.idx);
    if(lineIdx===idx)lines[i].classList.add('active');
    else if(Math.abs(lineIdx-idx)===1)lines[i].classList.add('near');
  }
  const active=lyricsTrack.querySelector('.lyricLine.active');
  if(active){
    // 相对于整个窗口居中，而非仅歌词视口居中
    const viewportRect=lyricsViewport.getBoundingClientRect();
    const windowCenter=window.innerHeight/2;
    const targetY=windowCenter-viewportRect.top-active.offsetHeight/2;
    const ty=-(active.offsetTop)+targetY;
    lyricsTrack.style.transform=`translateY(${ty}px)`;
  }
}
function updateUI(){
  const dur=getDuration(), cur=getCurTime();
  progress.value=dur?(cur/dur*100):0;
  timeEl.textContent=`${fmt(cur)} / ${fmt(dur)}`;
  scrollLyrics();
}

/* ===== 虚拟时钟（纯歌词模式） ===== */
function startVirt(){
  if(virtTimer)return;
  virtPlaying=true; playBtn.textContent='Ⅱ';
  let last=performance.now();
  virtTimer=setInterval(()=>{
    const now=performance.now();
    virtTime+=(now-last)/1000; last=now;
    const dur=getDuration();
    if(virtTime>=dur && dur>0){
      virtTime=dur;
      // 10秒后显示结束画面
      setTimeout(()=>{
        document.querySelector('#endScreen').classList.add('show');
        document.querySelector('.lyricsViewport').style.opacity='0';
      },10000);
      // 歌单自动播放模式：播完自动切下一首
      if(playlistPlaying&&currentPlaylist&&currentPlaylist.mode==='auto'){
        stopVirt();
        const interval=(currentPlaylist.interval||3)*1000;
        setTimeout(()=>nextSong(),interval);
      }else{
        stopVirt();
      }
    }
    updateUI();
  },80);
}
function stopVirt(){
  if(virtTimer){clearInterval(virtTimer);virtTimer=null;}
  virtPlaying=false; playBtn.textContent='▶';
  releaseScreenOn();
}
function isPlaying(){return hasAudio()?!audio.paused:virtPlaying;}
function doPlay(){
  // 隐藏结束画面
  document.querySelector('#endScreen').classList.remove('show');
  document.querySelector('.lyricsViewport').style.opacity='1';
  if(hasAudio()){audio.play().catch(()=>{});}
  else{
    if(virtTime>=getDuration()-0.5)virtTime=0;
    startVirt();
  }
  keepScreenOn();
}
function startCountdownThenPlay(){
  if(countdownTimer){clearInterval(countdownTimer);countdownTimer=null;}
  // 切歌立刻显示全屏歌名
  if(current.title&&current.title!==lastSplashTitle){
    showTitleSplash(current.title,current.artist);
  }
  let remain=countdownSec;
  countdownDisplay.classList.remove('hidden');
  // 显示第一个数字，触发动画
  countdownDisplay.textContent=remain;
  countdownDisplay.classList.remove('show');
  void countdownDisplay.offsetWidth; // 强制重排，重启动画
  countdownDisplay.classList.add('show');

  countdownTimer=setInterval(()=>{
    remain--;
    if(remain<=0){
      clearInterval(countdownTimer);countdownTimer=null;
      countdownDisplay.classList.add('hidden');
      countdownDisplay.classList.remove('show');
      // 倒计时结束才开始播放
      doPlay();
      resetHideTimer();
    }else{
      // 每个数字触发一次动画
      countdownDisplay.textContent=remain;
      countdownDisplay.classList.remove('show');
      void countdownDisplay.offsetWidth;
      countdownDisplay.classList.add('show');
    }
  },1000);
}
let countdownShownOnce=false;
function togglePlay(){
  if(isPlaying()){
    if(hasAudio())audio.pause();else stopVirt();
    if(countdownTimer){clearInterval(countdownTimer);countdownTimer=null;countdownDisplay.classList.add('hidden');}
    showControls();
    return;
  }
  // 只有第一次播放、或切歌后第一次播放才走倒计时，暂停后继续不走
  if(countdownSec>0&&!countdownShownOnce){
    countdownShownOnce=true;
    startCountdownThenPlay();
  }
  else{doPlay();resetHideTimer();}
}
function seekBy(sec){
  if(hasAudio()){
    audio.currentTime=Math.max(0,Math.min(audio.duration||0,audio.currentTime+sec));
  }else{
    virtTime=Math.max(0,Math.min(getDuration(),virtTime+sec));
    updateUI();
  }
}

/* ===== 屏幕常亮（防止手机息屏） ===== */
async function keepScreenOn(){
  try{
    if(navigator.wakeLock){
      wakeLock=await navigator.wakeLock.request('screen');
    }
  }catch(e){}
}
function releaseScreenOn(){
  if(wakeLock){try{wakeLock.release();}catch(e){}wakeLock=null;}
}
// 页面从后台切回前台时重新请求常亮
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden && isPlaying()){keepScreenOn();}
});

/* ===== 双击快进快退反馈 ===== */
function showSeekFeedback(sec){
  if(seekFbTimer){clearTimeout(seekFbTimer);}
  seekFeedback.textContent = sec>0 ? `+${sec}s` : `${sec}s`;
  seekFeedback.classList.remove('hidden');
  seekFeedback.style.animation='none';
  seekFeedback.offsetHeight; // 触发重排
  seekFeedback.style.animation='';
  seekFbTimer=setTimeout(()=>{seekFeedback.classList.add('hidden');},800);
}

/* ===== 控制栏+歌单 自动隐藏 ===== */
function showControls(){
  controls.classList.remove('hiddenBar');
  resetHideTimer();
}
function toggleSearch(){
  searchPanel.classList.toggle('hiddenBar');
  if(!searchPanel.classList.contains('hiddenBar')){
    // 确保搜索栏在视口顶部，聚焦输入框，歌单滚到顶部
    window.scrollTo(0,0);
    localListEl.scrollTop=0;
    setTimeout(()=>filterInput.focus(),100);
  }else{
    filterInput.blur();
  }
}
function hideControls(){
  if(isPlaying()){
    controls.classList.add('hiddenBar');
    searchPanel.classList.add('hiddenBar');
  }
}
function resetHideTimer(){
  if(hideTimer)clearTimeout(hideTimer);
  hideTimer=setTimeout(hideControls,3000);
}
function hideNow(){
  controls.classList.add('hiddenBar');
  searchPanel.classList.add('hiddenBar');
  if(hideTimer)clearTimeout(hideTimer);
}
stage.addEventListener('click',()=>{if(!dragJustEnded)showControls();});
stage.addEventListener('touchstart',()=>{if(!dragJustEnded)showControls();},{passive:true});
controls.addEventListener('click',e=>{e.stopPropagation();showControls();});
controls.addEventListener('touchstart',e=>{e.stopPropagation();showControls();},{passive:true});

/* ===== 拖动歌词调整进度（优化版：rAF节流+缓存高亮行） ===== */
let dragState={dragging:false,startY:0,startTime:0,lastY:0,moved:false,pendingY:0};
let dragJustEnded=false;
const DRAG_SENSITIVITY=0.05;
const DRAG_THRESHOLD=8;
let lastDragIdx=-1; // 缓存上次高亮行索引，避免每次都遍历所有行
let rafId=null; // requestAnimationFrame id

function onDragStart(y){
  if(!current.lyrics.length)return;
  dragState.dragging=true;
  lyricsTrack.style.transition='none';
  dragState.startY=y;
  dragState.lastY=y;
  dragState.pendingY=y;
  dragState.moved=false;
  dragState.startTime=getCurTime();
  lastDragIdx=-1;
  if(hideTimer)clearTimeout(hideTimer);
  if(rafId){cancelAnimationFrame(rafId);rafId=null;}
}

function doDragUpdate(){
  rafId=null;
  if(!dragState.dragging||!dragState.moved)return;
  const y=dragState.pendingY;
  const delta=(dragState.startY-y)*DRAG_SENSITIVITY;
  let newTime=dragState.startTime+delta;
  newTime=Math.max(0,Math.min(getDuration(),newTime));
  // 预览歌词位置
  const t=newTime+offset;
  let idx=0;
  for(let i=0;i<current.lyrics.length;i++){if(current.lyrics[i].t<=t)idx=i;else break;}
  // 只改变化的行，不遍历所有
  if(idx!==lastDragIdx){
    const lines=lyricsTrack.children;
    // 清除旧高亮（只清相邻几行，不清所有）
    if(lastDragIdx>=0){
      for(let di=-1;di<=1;di++){
        const oldLine=lines[lastDragIdx+di];
        if(oldLine&&oldLine.classList.contains('lyricLine')){
          oldLine.classList.remove('active','near');
        }
      }
    }
    // 设置新高亮
    for(let di=-1;di<=1;di++){
      const line=lines[idx+di];
      if(line&&line.classList.contains('lyricLine')){
        if(di===0)line.classList.add('active');
        else line.classList.add('near');
      }
    }
    lastDragIdx=idx;
    // 滚动到当前行
    const active=lines[idx];
    if(active){
      const viewportRect=lyricsViewport.getBoundingClientRect();
      const windowCenter=window.innerHeight/2;
      const targetY=windowCenter-viewportRect.top-active.offsetHeight/2;
      const ty=-(active.offsetTop)+targetY;
      lyricsTrack.style.transform=`translateY(${ty}px)`;
    }
  }
  seekFeedback.classList.remove('hidden');
  seekFeedback.textContent=`${fmt(newTime)}`;
  dragState.lastY=y;
}

function onDragMove(y){
  if(!dragState.dragging)return;
  if(Math.abs(y-dragState.startY)>DRAG_THRESHOLD)dragState.moved=true;
  if(!dragState.moved)return;
  dragState.pendingY=y;
  // 用requestAnimationFrame节流，每帧只更新一次
  if(!rafId){
    rafId=requestAnimationFrame(doDragUpdate);
  }
}

function onDragEnd(){
  if(!dragState.dragging)return;
  const wasMoved=dragState.moved;
  dragState.dragging=false;
  lyricsTrack.style.transition='transform 0.3s ease-out';
  if(rafId){cancelAnimationFrame(rafId);rafId=null;}
  seekFeedback.classList.add('hidden');
  if(wasMoved){
    const delta=(dragState.startY-dragState.lastY)*DRAG_SENSITIVITY;
    let newTime=dragState.startTime+delta;
    newTime=Math.max(0,Math.min(getDuration(),newTime));
    if(hasAudio()){audio.currentTime=newTime;}
    else{virtTime=newTime;updateUI();}
    const sel=document.querySelector('#fontSize');
    if(sel)applyFontSize(sel.value);
    dragJustEnded=true;
    setTimeout(()=>{dragJustEnded=false;},350);
  }
  resetHideTimer();
}
// 触摸事件
lyricsViewport.addEventListener('touchstart',e=>{onDragStart(e.touches[0].clientY);},{passive:true});
lyricsViewport.addEventListener('touchmove',e=>{e.preventDefault();onDragMove(e.touches[0].clientY);},{passive:false});
lyricsViewport.addEventListener('touchend',onDragEnd);
// 鼠标事件（桌面端）
lyricsViewport.addEventListener('mousedown',e=>{onDragStart(e.clientY);});
window.addEventListener('mousemove',e=>{onDragMove(e.clientY);});
window.addEventListener('mouseup',onDragEnd);

/* iOS高度自适应：地址栏显示/隐藏时重新计算可视高度 */
function fixIOSHeight(){
  const h=window.innerHeight;
  document.querySelector('main').style.height=h+'px';
  document.querySelector('main').style.maxHeight=h+'px';
}
window.addEventListener('resize',fixIOSHeight);
window.addEventListener('orientationchange',()=>{setTimeout(fixIOSHeight,300);});
fixIOSHeight();

/* 双击左侧快退0.2秒，双击右侧快进0.2秒，带反馈 */
stage.addEventListener('dblclick',e=>{
  e.preventDefault();
  const isLeft=e.clientX<window.innerWidth/2;
  const delta=isLeft?-0.2:0.2;
  seekBy(delta);
  showSeekFeedback(delta);
  showControls();
});

/* ===== 加载本地歌曲 ===== */
async function loadLocalLRC(song){
  try{
    const resp=await fetch(song.lrc);
    if(!resp.ok) throw new Error('HTTP '+resp.status);
    return parseLRC(await resp.text());
  }catch(e){console.warn('LRC加载失败:',song.lrc,e);return [];}
}
async function setLocalTrack(song){
  stopVirt(); virtTime=0;
  current={title:song.title,artist:song.artist,lyrics:[]};
  countdownShownOnce=false;
  titleEl.textContent=current.title;
  if(hasAudio()){audio.pause();audio.src='';}
  playBtn.textContent='▶';
  buildLyrics();
  current.lyrics=await loadLocalLRC(song);
  buildLyrics(); updateUI();
  // 选完歌自动收起搜索栏（所有设备）
  searchPanel.classList.add('hiddenBar');
  showControls();
  // 切歌立刻显示全屏歌名
  if(current.title&&current.title!==lastSplashTitle){
    showTitleSplash(current.title,current.artist);
  }
}

/* ===== 本地歌单 ===== */
function renderLocalList(filter=''){
  const f=filter.trim().toLowerCase();
  const list=f?localSongs.filter(s=>s.title.toLowerCase().includes(f)||s.artist.toLowerCase().includes(f)):localSongs;
  if(!list.length){localListEl.innerHTML='<div class="resultMeta" style="padding:10px 0;color:#888">没有匹配的歌曲。</div>';return;}
  localListEl.innerHTML='';
  for(const s of list){
    const row=document.createElement('div');row.className='result';
    row.innerHTML=`<div><div class="resultTitle">${s.title}</div><div class="resultMeta">${s.artist} · 本地LRC</div></div>`;
    row.onclick=()=>{
    // 搜索选歌时停止歌单播放
    if(playlistPlaying){
      playlistPlaying=false;
      if(autoNextTimer){clearTimeout(autoNextTimer);autoNextTimer=null;}
      playingListBtn.style.display='none';
    }
    setLocalTrack(s);
  };
    localListEl.appendChild(row);
  }
}
async function loadLocalSongs(){
  try{
    const resp=await fetch('data/songs.json');
    if(!resp.ok)throw new Error('HTTP '+resp.status);
    localSongs=await resp.json();
    renderLocalList();
  }catch(e){
    localListEl.innerHTML='<div class="resultMeta" style="padding:10px 0;color:#f36b0a">歌单加载失败：请用「启动播放器.bat」打开，不要直接双击index.html</div>';
  }
}

/* ===== 歌单面板（按歌手点歌） ===== */
// 有头像的主要歌手白名单
const SINGER_WITH_AVATAR = ["陈奕迅","容祖儿","杨千嬅","邓紫棋","周柏豪","侧田","梁静茹","张惠妹","林俊杰","王菲","蔡依林","孙燕姿","郑秀文","陈慧娴","吴雨霏","五月天","张敬轩","A-Lin","谢安琪","周杰伦"];
function getSingerList(){
  const map={};
  for(const s of localSongs){
    if(!SINGER_WITH_AVATAR.includes(s.artist))continue;
    if(!map[s.artist])map[s.artist]=0;
    map[s.artist]++;
  }
  return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([name,count])=>({name,count}));
}

function renderSingers(){
  const singers=getSingerList();
  singerScroll.innerHTML='';
  for(const s of singers){
    const item=document.createElement('div');
    item.className='singerItem'+(currentSinger===s.name?' active':'');
    item.innerHTML=`<img class="singerAvatar" src="assets/singers/${s.name}.jpg" alt="${s.name}" onerror="this.style.background='#333';this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%23333%22/><text x=%2250%22 y=%2260%22 text-anchor=%22middle%22 fill=%22%23888%22 font-size=%2230%22>${s.name[0]}</text></svg>'"><div class="singerName">${s.name}</div><div class="singerCount">${s.count}首</div>`;
    item.onclick=()=>selectSinger(s.name);
    singerScroll.appendChild(item);
  }
}

function selectSinger(name){
  currentSinger=name;
  // 更新歌手选中状态
  document.querySelectorAll('.singerItem').forEach(el=>{
    el.classList.toggle('active',el.querySelector('.singerName').textContent===name);
  });
  renderPlaylistSongs();
}

function renderPlaylistSongs(){
  if(!currentSinger){
    playlistSongs.innerHTML='<div class="playlistEmpty">请选择一位歌手</div>';
    return;
  }
  const songs=localSongs.filter(s=>s.artist===currentSinger);
  if(!songs.length){
    playlistSongs.innerHTML='<div class="playlistEmpty">该歌手暂无歌曲</div>';
    return;
  }
  playlistSongs.innerHTML='';
  songs.forEach((s,i)=>{
    const item=document.createElement('div');
    item.className='playlistSongItem';
    item.innerHTML=`<div class="songIdx">${i+1}</div><div class="songInfo"><div class="songTitle">${s.title}</div><div class="songArtist">${s.artist}</div></div><div class="songPlay">▶</div>`;
    item.onclick=()=>{
      setLocalTrack(s);
      closePlaylist();
    };
    playlistSongs.appendChild(item);
  });
}

function openPlaylist(){
  if(!localSongs.length){loadLocalSongs();}
  renderSingers();
  if(!currentSinger && getSingerList().length){currentSinger=getSingerList()[0].name;}
  renderPlaylistSongs();
  playlistPanel.classList.add('show');
  playlistOverlay.classList.add('show');
  playlistPanel.classList.remove('hidden');
  playlistOverlay.classList.remove('hidden');
}

function closePlaylist(){
  playlistPanel.classList.remove('show');
  playlistOverlay.classList.remove('show');
  setTimeout(()=>{
    playlistPanel.classList.add('hidden');
    playlistOverlay.classList.add('hidden');
  },350);
}

/* ===== 全屏歌名渐隐 ===== */
function showTitleSplash(title,artist){
  if(!titleSplashEnabled)return;
  lastSplashTitle=title||'';
  titleSplashSong.textContent=title||'';
  titleSplashArtist.textContent=artist||'';
  titleSplash.classList.remove('hidden','hide');
  if(titleSplashTimer)clearTimeout(titleSplashTimer);
  // 显示时长：和倒计时一致，最少2.5秒
  const showTime=Math.max(countdownSec*1000+1000,2500);
  titleSplashTimer=setTimeout(()=>{
    titleSplash.classList.add('hide');
    setTimeout(()=>titleSplash.classList.add('hidden'),800);
  },showTime);
}

/* ===== 我的歌单：存储 ===== */
function loadPlaylists(){
  try{
    const data=localStorage.getItem(STORAGE_KEY);
    playlists=data?JSON.parse(data):[];
  }catch(e){playlists=[];}
}
function savePlaylists(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(playlists));
}

/* ===== 我的歌单：面板控制 ===== */
function openMyPlaylist(){
  loadPlaylists();
  renderPlaylistList();
  showMpView('list');
  myPlaylistPanel.classList.remove('hidden');
  myPlaylistOverlay.classList.remove('hidden');
  requestAnimationFrame(()=>{
    myPlaylistPanel.classList.add('show');
    myPlaylistOverlay.classList.add('show');
  });
}
function closeMyPlaylist(){
  myPlaylistPanel.classList.remove('show');
  myPlaylistOverlay.classList.remove('show');
  setTimeout(()=>{
    myPlaylistPanel.classList.add('hidden');
    myPlaylistOverlay.classList.add('hidden');
  },350);
}
function showMpView(view){
  mpListView.classList.toggle('hidden',view!=='list');
  mpEditView.classList.toggle('hidden',view!=='edit');
  mpAddView.classList.toggle('hidden',view!=='add');
}

/* ===== 我的歌单：列表渲染 ===== */
function renderPlaylistList(){
  mpList.innerHTML='';
  if(!playlists.length){
    mpList.innerHTML='<div style="text-align:center;color:#555;padding:40px;font-size:14px">还没有歌单，点击上方"新建歌单"创建</div>';
    return;
  }
  playlists.forEach((pl,idx)=>{
    const item=document.createElement('div');
    item.className='mpListItem';
    item.innerHTML=`
      <div class="mpListItemInfo">
        <div class="mpListItemName">${pl.name}</div>
        <div class="mpListItemMeta">${pl.songs.length}首 · ${pl.mode==='auto'?'自动':'手动'} · 间隔${pl.interval||3}秒</div>
      </div>
      <div class="mpListItemActions">
        <button class="mpBtn small primary" data-act="play">▶</button>
        <button class="mpBtn small" data-act="edit">✎</button>
        <button class="mpBtn small danger" data-act="delete">🗑</button>
      </div>`;
    item.querySelector('[data-act="play"]').onclick=e=>{e.stopPropagation();playPlaylist(idx);};
    item.querySelector('[data-act="edit"]').onclick=e=>{e.stopPropagation();editPlaylist(idx);};
    item.querySelector('[data-act="delete"]').onclick=e=>{
      e.stopPropagation();
      if(confirm(`确定删除歌单"${pl.name}"？`)){
        playlists.splice(idx,1);
        savePlaylists();
        renderPlaylistList();
      }
    };
    mpList.appendChild(item);
  });
}

/* ===== 我的歌单：新建/编辑 ===== */
function newPlaylist(){
  const name=prompt('请输入歌单名称：','新歌单');
  if(!name)return;
  const pl={id:Date.now(),name:name.trim(),songs:[],mode:'auto',interval:3};
  playlists.push(pl);
  savePlaylists();
  editPlaylist(playlists.length-1);
}
function editPlaylist(idx){
  currentPlaylist=playlists[idx];
  mpPlaylistName.value=currentPlaylist.name;
  mpPlayMode.value=currentPlaylist.mode||'manual';
  mpInterval.value=currentPlaylist.interval||3;
  renderEditSongs();
  showMpView('edit');
}
function renderEditSongs(){
  mpEditSongs.innerHTML='';
  if(!currentPlaylist.songs.length){
    mpEditSongs.innerHTML='<div style="text-align:center;color:#555;padding:30px;font-size:13px">歌单为空，点击"+ 添加歌曲"</div>';
    return;
  }
  currentPlaylist.songs.forEach((s,i)=>{
    const item=document.createElement('div');
    item.className='mpSongItem';
    item.innerHTML=`
      <span class="mpSongIdx">${i+1}</span>
      <div class="mpSongInfo">
        <div class="mpSongTitle">${s.title}</div>
        <div class="mpSongArtist">${s.artist}</div>
      </div>
      <button class="mpSongUp" title="上移">↑</button>
      <button class="mpSongDown" title="下移">↓</button>
      <button class="mpSongRemove" title="移除">✕</button>`;
    item.querySelector('.mpSongUp').onclick=()=>{
      if(i>0){
        [currentPlaylist.songs[i-1],currentPlaylist.songs[i]]=[currentPlaylist.songs[i],currentPlaylist.songs[i-1]];
        savePlaylists();renderEditSongs();
      }
    };
    item.querySelector('.mpSongDown').onclick=()=>{
      if(i<currentPlaylist.songs.length-1){
        [currentPlaylist.songs[i+1],currentPlaylist.songs[i]]=[currentPlaylist.songs[i],currentPlaylist.songs[i+1]];
        savePlaylists();renderEditSongs();
      }
    };
    item.querySelector('.mpSongRemove').onclick=()=>{
      currentPlaylist.songs.splice(i,1);
      savePlaylists();renderEditSongs();
    };
    mpEditSongs.appendChild(item);
  });
}

/* ===== 我的歌单：添加歌曲 ===== */
function openAddSong(){
  mpAddFilter.value='';
  renderAddSongList('');
  showMpView('add');
}
function renderAddSongList(keyword){
  mpAddList.innerHTML='';
  const kw=keyword.trim().toLowerCase();
  const addedKeys=new Set(currentPlaylist.songs.map(s=>s.artist+' - '+s.title));
  const list=kw?localSongs.filter(s=>(s.title+s.artist).toLowerCase().includes(kw)):localSongs.slice(0,100);
  list.forEach(s=>{
    const key=s.artist+' - '+s.title;
    const added=addedKeys.has(key);
    const item=document.createElement('div');
    item.className='mpAddItem'+(added?' added':'');
    item.innerHTML=`
      <div class="mpSongInfo">
        <div class="mpSongTitle">${s.title}</div>
        <div class="mpSongArtist">${s.artist}</div>
      </div>
      <span class="addBtn">${added?'✓':'+'}</span>`;
    if(!added){
      item.onclick=()=>{
        currentPlaylist.songs.push({artist:s.artist,title:s.title});
        savePlaylists();
        renderAddSongList(mpAddFilter.value);
      };
    }
    mpAddList.appendChild(item);
  });
}

/* ===== 我的歌单：播放 ===== */
function playPlaylist(idx){
  const pl=playlists[idx];
  if(!pl.songs.length){alert('歌单为空，请先添加歌曲');return;}
  currentPlaylist=pl;
  currentSongIndex=0;
  playlistPlaying=true;
  closeMyPlaylist();
  playSongInPlaylist();
}
function playSongInPlaylist(){
  if(!currentPlaylist||!playlistPlaying)return;
  const s=currentPlaylist.songs[currentSongIndex];
  if(!s)return;
  // 匹配歌曲
  const match=localSongs.find(x=>x.artist===s.artist&&x.title===s.title);
  if(match){
    isAutoPlaylistSwitch=true;
    setLocalTrack(match);
    setTimeout(()=>{
      togglePlay();
      isAutoPlaylistSwitch=false;
    },300);
  }else{
    // 匹配不到，跳过
    nextSong();
  }
}
function nextSong(){
  if(!currentPlaylist||!playlistPlaying)return;
  if(autoNextTimer){clearTimeout(autoNextTimer);autoNextTimer=null;}
  currentSongIndex++;
  if(currentSongIndex>=currentPlaylist.songs.length){
    // 播完了
    playlistPlaying=false;
    return;
  }
  playSongInPlaylist();
}
function prevSong(){
  if(!currentPlaylist||!playlistPlaying)return;
  if(autoNextTimer){clearTimeout(autoNextTimer);autoNextTimer=null;}
  currentSongIndex=Math.max(0,currentSongIndex-1);
  playSongInPlaylist();
}
// 歌词播完检测（虚拟时钟走到最后一行时间）
function checkPlaylistEnd(){
  if(!playlistPlaying||!currentPlaylist)return;
  if(currentPlaylist.mode!=='auto')return;
  if(!current.lyrics.length)return;
  const lastTime=current.lyrics[current.lyrics.length-1].time;
  if(virtTime>=lastTime+1){
    const interval=(currentPlaylist.interval||3)*1000;
    if(!autoNextTimer){
      autoNextTimer=setTimeout(()=>nextSong(),interval);
    }
  }
}

/* ===== 我的歌单：扫码导入 ===== */
let scanStream=null, scanRAF=null, scanRunning=false;
const scanModal=document.querySelector('#scanModal');
const scanVideo=document.querySelector('#scanVideo');
const scanCanvas=document.querySelector('#scanCanvas');
const scanCtx=scanCanvas.getContext('2d');
const scanResult=document.querySelector('#scanResult');

function openScan(){
  scanModal.classList.remove('hidden');
  scanResult.textContent='';
  scanResult.className='scanResult';
  // 启动摄像头
  navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})
    .then(stream=>{
      scanStream=stream;
      scanVideo.srcObject=stream;
      scanVideo.setAttribute('playsinline',true);
      scanVideo.play();
      scanRunning=true;
      scanLoop();
    })
    .catch(err=>{
      scanResult.textContent='无法访问摄像头：'+err.message;
      scanResult.className='scanResult fail';
    });
}
function closeScan(){
  scanRunning=false;
  if(scanRAF)cancelAnimationFrame(scanRAF);
  if(scanStream){
    scanStream.getTracks().forEach(t=>t.stop());
    scanStream=null;
  }
  scanVideo.srcObject=null;
  scanModal.classList.add('hidden');
}
function scanLoop(){
  if(!scanRunning)return;
  if(scanVideo.readyState===scanVideo.HAVE_ENOUGH_DATA){
    scanCanvas.width=scanVideo.videoWidth;
    scanCanvas.height=scanVideo.videoHeight;
    scanCtx.drawImage(scanVideo,0,0,scanCanvas.width,scanCanvas.height);
    const imageData=scanCtx.getImageData(0,0,scanCanvas.width,scanCanvas.height);
    const code=jsQR(imageData.data,imageData.width,imageData.height);
    if(code&&code.data){
      // 识别到二维码
      scanRunning=false;
      handleScanResult(code.data);
      return;
    }
  }
  scanRAF=requestAnimationFrame(scanLoop);
}
function handleScanResult(data){
  // 支持两种格式：URL（含#pl=）或纯文本
  let plData=null;
  const urlMatch=data.match(/#pl=(.+)/);
  if(urlMatch){
    try{
      plData=decodeURIComponent(escape(atob(urlMatch[1])));
    }catch(e){}
  }
  if(!plData&&data.includes('||')){
    plData=data;
  }
  if(!plData){
    scanResult.textContent='未识别到歌单二维码';
    scanResult.className='scanResult fail';
    setTimeout(()=>{scanRunning=true;scanLoop();},1500);
    return;
  }
  // 解析歌单
  const parts=plData.split('||');
  const name=parts[0]||'扫码导入歌单';
  const songs=[];
  const matched=[],unmatched=[];
  for(let i=1;i<parts.length;i++){
    const sp=parts[i].split(' - ');
    if(sp.length>=2){
      const artist=sp[0].trim();
      const title=sp.slice(1).join(' - ').trim();
      const match=localSongs.find(s=>s.artist===artist&&s.title===title);
      if(match){songs.push({artist,title});matched.push(artist+' - '+title);}
      else{unmatched.push(artist+' - '+title);}
    }
  }
  if(!songs.length){
    scanResult.textContent='未匹配到任何歌曲';
    scanResult.className='scanResult fail';
    setTimeout(()=>{scanRunning=true;scanLoop();},1500);
    return;
  }
  const pl={id:Date.now(),name,songs,mode:'auto',interval:3};
  playlists.push(pl);
  savePlaylists();
  scanResult.textContent=`✓ 成功导入"${name}"，${songs.length}首`;
  scanResult.className='scanResult ok';
  // 震动反馈（手机）
  if(navigator.vibrate)navigator.vibrate(200);
  setTimeout(()=>{
    closeScan();
    renderPlaylistList();
  },1500);
}

/* 相册选择图片识别 */
const scanAlbumInput=document.querySelector('#scanAlbumInput');
document.querySelector('#scanAlbumBtn').onclick=()=>scanAlbumInput.click();
scanAlbumInput.onchange=e=>{
  const file=e.target.files[0];
  if(!file)return;
  const img=new Image();
  img.onload=()=>{
    const c=document.createElement('canvas');
    c.width=img.width;c.height=img.height;
    const cx=c.getContext('2d');
    cx.drawImage(img,0,0);
    const imgData=cx.getImageData(0,0,c.width,c.height);
    const code=jsQR(imgData.data,imgData.width,imgData.height);
    if(code&&code.data){
      handleScanResult(code.data);
    }else{
      scanResult.textContent='未在图片中识别到二维码';
      scanResult.className='scanResult fail';
    }
  };
  img.onerror=()=>{
    scanResult.textContent='图片加载失败';
    scanResult.className='scanResult fail';
  };
  img.src=URL.createObjectURL(file);
  scanAlbumInput.value='';
};

/* ===== 我的歌单：导出PNG（高分辨率 + 高度自适应 + 完整歌单） ===== */
function exportPlaylistPNG(){
  if(!currentPlaylist)return;
  // 高分辨率，宽度1440，高度根据歌曲数量自适应
  const W=1440;
  const topArea=620; // 顶部logo+标题区域
  const bottomArea=320; // 底部二维码+品牌区域
  const lineH=64; // 每行高度
  const H=topArea + currentPlaylist.songs.length*lineH + bottomArea;

  const canvas=document.createElement('canvas');
  canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d');

  // 背景渐变
  const grad=ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,'#1a1a1a');
  grad.addColorStop(1,'#0a0a0a');
  ctx.fillStyle=grad;
  ctx.fillRect(0,0,W,H);

  // 顶部装饰
  ctx.fillStyle='#f36b0a';
  ctx.fillRect(0,0,W,10);

  // 生成二维码数据
  const plData=currentPlaylist.name+'||'+currentPlaylist.songs.map(s=>s.artist+' - '+s.title).join('||');
  const b64=btoa(unescape(encodeURIComponent(plData)));
  const qrUrl='https://juzi-lyrics.pages.dev/#pl='+b64;

  // 加载logo并绘制
  const logoImg=new Image();
  logoImg.crossOrigin='anonymous';
  logoImg.onload=function(){
    // Logo（顶部居中）
    const logoW=480;
    const logoH=logoW*logoImg.height/logoImg.width;
    ctx.drawImage(logoImg,(W-logoW)/2,100,logoW,logoH);

    // 歌单名称
    ctx.fillStyle='#fff';
    ctx.font='bold 72px sans-serif';
    ctx.textAlign='center';
    ctx.fillText(currentPlaylist.name,W/2,100+logoH+100);

    // 歌曲数量
    ctx.fillStyle='#888';
    ctx.font='40px sans-serif';
    ctx.fillText(currentPlaylist.songs.length+' 首歌曲',W/2,100+logoH+170);

    // 歌曲列表（全部显示）
    ctx.textAlign='left';
    currentPlaylist.songs.forEach((s,i)=>{
      const y=topArea+i*lineH;
      // 序号
      ctx.fillStyle='#f36b0a';
      ctx.font='bold 36px sans-serif';
      ctx.fillText(String(i+1).padStart(2,'0'),120,y);
      // 歌名
      ctx.fillStyle='#ddd';
      ctx.font='38px sans-serif';
      const title=s.title.length>24?s.title.slice(0,24)+'…':s.title;
      ctx.fillText(title,200,y);
      // 歌手
      ctx.fillStyle='#666';
      ctx.font='30px sans-serif';
      ctx.textAlign='right';
      ctx.fillText(s.artist,W-120,y);
      ctx.textAlign='left';
    });

    // 底部品牌
    ctx.fillStyle='#444';
    ctx.font='28px sans-serif';
    ctx.textAlign='center';
    ctx.fillText('桔子好声音 · JUZI HAOSHENGYIN',W/2,H-40);

    // 下载
    const link=document.createElement('a');
    link.download=`${currentPlaylist.name}.png`;
    link.href=canvas.toDataURL('image/png');
    link.click();
  };
  logoImg.onerror=function(){
    // logo加载失败，用文字代替
    ctx.fillStyle='#f36b0a';
    ctx.font='bold 100px sans-serif';
    ctx.textAlign='center';
    ctx.fillText('桔子好声音',W/2,200);
    ctx.fillStyle='#fff';
    ctx.font='bold 72px sans-serif';
    ctx.fillText(currentPlaylist.name,W/2,320);
    ctx.fillStyle='#888';
    ctx.font='40px sans-serif';
    ctx.fillText(currentPlaylist.songs.length+' 首歌曲',W/2,400);
    // 直接下载
    const link=document.createElement('a');
    link.download=`${currentPlaylist.name}.png`;
    link.href=canvas.toDataURL('image/png');
    link.click();
  };
  logoImg.src='assets/logo.png?t='+Date.now();
}

/* ===== 我的歌单：单独导出二维码 ===== */
function exportPlaylistQR(){
  if(!currentPlaylist)return;
  // 生成二维码数据
  const plData=currentPlaylist.name+'||'+currentPlaylist.songs.map(s=>s.artist+' - '+s.title).join('||');
  const b64=btoa(unescape(encodeURIComponent(plData)));
  const qrUrl='https://juzi-lyrics.pages.dev/#pl='+b64;

  // 正方形画布，二维码居中
  const S=1080;
  const canvas=document.createElement('canvas');
  canvas.width=S;canvas.height=S;
  const ctx=canvas.getContext('2d');

  // 背景
  ctx.fillStyle='#111';
  ctx.fillRect(0,0,S,S);

  // 顶部装饰
  ctx.fillStyle='#f36b0a';
  ctx.fillRect(0,0,S,10);

  // 加载logo
  const logoImg=new Image();
  logoImg.crossOrigin='anonymous';
  logoImg.onload=function(){
    // Logo（顶部居中）
    const logoW=360;
    const logoH=logoW*logoImg.height/logoImg.width;
    ctx.drawImage(logoImg,(S-logoW)/2,100,logoW,logoH);

    // 歌单名称
    ctx.fillStyle='#fff';
    ctx.font='bold 56px sans-serif';
    ctx.textAlign='center';
    ctx.fillText(currentPlaylist.name,S/2,100+logoH+80);

    // 提示文字
    ctx.fillStyle='#888';
    ctx.font='32px sans-serif';
    ctx.fillText('扫码导入歌单 · '+currentPlaylist.songs.length+'首',S/2,100+logoH+140);

    // 二维码（居中，大尺寸）
    const qrSize=500;
    const qrX=(S-qrSize)/2;
    const qrY=100+logoH+180;
    // 白色底
    ctx.fillStyle='#fff';
    ctx.fillRect(qrX-20,qrY-20,qrSize+40,qrSize+40);
    // 生成二维码
    try{
      const qr=qrcode(0,'M'); // M级纠错，更易扫
      qr.addData(qrUrl);
      qr.make();
      const modules=qr.getModuleCount();
      const cellSize=qrSize/modules;
      for(let r=0;r<modules;r++){
        for(let c=0;c<modules;c++){
          if(qr.isDark(r,c)){
            ctx.fillStyle='#000';
            ctx.fillRect(qrX+c*cellSize,qrY+r*cellSize,cellSize,cellSize);
          }
        }
      }
    }catch(e){}

    // 底部品牌
    ctx.fillStyle='#444';
    ctx.font='28px sans-serif';
    ctx.textAlign='center';
    ctx.fillText('桔子好声音 · JUZI HAOSHENGYIN',S/2,S-40);

    // 下载
    const link=document.createElement('a');
    link.download=`${currentPlaylist.name}_二维码.png`;
    link.href=canvas.toDataURL('image/png');
    link.click();
  };
  logoImg.onerror=function(){
    // logo加载失败，直接画二维码
    ctx.fillStyle='#f36b0a';
    ctx.font='bold 80px sans-serif';
    ctx.textAlign='center';
    ctx.fillText('桔子好声音',S/2,150);
    ctx.fillStyle='#fff';
    ctx.font='bold 56px sans-serif';
    ctx.fillText(currentPlaylist.name,S/2,250);

    const qrSize=500;
    const qrX=(S-qrSize)/2;
    const qrY=320;
    ctx.fillStyle='#fff';
    ctx.fillRect(qrX-20,qrY-20,qrSize+40,qrSize+40);
    try{
      const qr=qrcode(0,'M');
      qr.addData(qrUrl);
      qr.make();
      const modules=qr.getModuleCount();
      const cellSize=qrSize/modules;
      for(let r=0;r<modules;r++){
        for(let c=0;c<modules;c++){
          if(qr.isDark(r,c)){
            ctx.fillStyle='#000';
            ctx.fillRect(qrX+c*cellSize,qrY+r*cellSize,cellSize,cellSize);
          }
        }
      }
    }catch(e){}

    const link=document.createElement('a');
    link.download=`${currentPlaylist.name}_二维码.png`;
    link.href=canvas.toDataURL('image/png');
    link.click();
  };
  logoImg.src='assets/logo.png?t='+Date.now();
}

/* ===== 事件绑定 ===== */
audio.addEventListener('timeupdate',()=>{if(hasAudio())updateUI();});
audio.addEventListener('play',()=>{playBtn.textContent='Ⅱ';resetHideTimer();});
audio.addEventListener('pause',()=>{if(hasAudio()){playBtn.textContent='▶';showControls();releaseScreenOn();}});
audio.addEventListener('ended',()=>{playBtn.textContent='▶';showControls();releaseScreenOn();});

playBtn.onclick=togglePlay;
progress.oninput=()=>{
  const dur=getDuration();if(!dur)return;
  const t=Number(progress.value)/100*dur;
  if(hasAudio())audio.currentTime=t;else virtTime=t;
  scrollLyrics();
};
progress.addEventListener('pointerdown',()=>{if(hideTimer)clearTimeout(hideTimer);});
progress.addEventListener('pointerup',resetHideTimer);

document.querySelector('#fullBtn').onclick=e=>{
  e.stopPropagation();
  const isFull=document.fullscreenElement||document.webkitFullscreenElement;
  if(isFull){
    if(document.exitFullscreen)document.exitFullscreen().catch(()=>{});
    else if(document.webkitExitFullscreen)document.webkitExitFullscreen();
  }else{
    const el=document.documentElement;
    if(el.requestFullscreen)el.requestFullscreen().catch(()=>{});
    else if(el.webkitRequestFullscreen)el.webkitRequestFullscreen();
  }
};
// 全屏状态变化时自动隐藏/显示控制栏
document.addEventListener('fullscreenchange',()=>{
  if(document.fullscreenElement||document.webkitFullscreenElement){
    hideNow();
  }else{
    showControls();
  }
});
document.addEventListener('webkitfullscreenchange',()=>{
  if(document.fullscreenElement||document.webkitFullscreenElement){
    hideNow();
  }else{
    showControls();
  }
});
document.querySelector('#hideBtn').onclick=e=>{e.stopPropagation();hideNow();};
document.querySelector('#searchToggleBtn').onclick=e=>{e.stopPropagation();toggleSearch();};
playlistBtn.onclick=e=>{e.stopPropagation();openPlaylist();};
closePlaylistBtn.onclick=closePlaylist;
playlistOverlay.onclick=closePlaylist;
playlistPanel.addEventListener('click',e=>e.stopPropagation());

/* ===== 我的歌单事件绑定 ===== */
myPlaylistBtn.onclick=e=>{e.stopPropagation();openMyPlaylist();};
closeMyPlaylistBtn.onclick=closeMyPlaylist;
myPlaylistOverlay.onclick=closeMyPlaylist;
myPlaylistPanel.addEventListener('click',e=>e.stopPropagation());
prevBtn.onclick=e=>{e.stopPropagation();prevSong();};
nextBtn.onclick=e=>{e.stopPropagation();nextSong();};
document.querySelector('#clearBtn').onclick=e=>{
  e.stopPropagation();
  if(!current.lyrics.length)return;
  if(confirm('确定清空当前歌词？')){
    if(isPlaying())togglePlay();
    current={title:'',artist:'',lyrics:[]};
    lastSplashTitle='';
    titleEl.textContent='未选择歌曲';
    buildLyrics();
    updateUI();
  }
};

// 歌单列表
document.querySelector('#newPlaylistBtn').onclick=newPlaylist;
document.querySelector('#scanImportBtn').onclick=openScan;
document.querySelector('#closeScanBtn').onclick=closeScan;

// 歌单编辑
document.querySelector('#mpBackBtn').onclick=()=>{showMpView('list');renderPlaylistList();};
document.querySelector('#mpSaveNameBtn').onclick=()=>{
  if(currentPlaylist){
    currentPlaylist.name=mpPlaylistName.value.trim()||'未命名';
    savePlaylists();
    alert('歌单名称已保存');
  }
};
document.querySelector('#mpAddSongBtn').onclick=openAddSong;
document.querySelector('#mpPlayBtn').onclick=()=>{
  const idx=playlists.findIndex(p=>p.id===currentPlaylist.id);
  if(idx>=0){closeMyPlaylist();playPlaylist(idx);}
};
document.querySelector('#mpExportPngBtn').onclick=exportPlaylistPNG;
document.querySelector('#mpExportQrBtn').onclick=exportPlaylistQR;
document.querySelector('#mpDeleteBtn').onclick=()=>{
  if(currentPlaylist&&confirm(`确定删除歌单"${currentPlaylist.name}"？`)){
    const idx=playlists.findIndex(p=>p.id===currentPlaylist.id);
    if(idx>=0)playlists.splice(idx,1);
    savePlaylists();
    showMpView('list');
    renderPlaylistList();
  }
};
mpPlayMode.onchange=()=>{if(currentPlaylist){currentPlaylist.mode=mpPlayMode.value;savePlaylists();}};
mpInterval.onchange=()=>{if(currentPlaylist){currentPlaylist.interval=Number(mpInterval.value)||3;savePlaylists();}};

// 添加歌曲
document.querySelector('#mpAddBackBtn').onclick=()=>{showMpView('edit');renderEditSongs();};
mpAddFilter.addEventListener('input',e=>renderAddSongList(e.target.value));
filterInput.addEventListener('input',e=>renderLocalList(e.target.value));
filterInput.addEventListener('focus',()=>{if(hideTimer)clearTimeout(hideTimer);});
filterInput.addEventListener('blur',()=>resetHideTimer());

document.querySelector('#settingsBtn').onclick=()=>{document.querySelector('#settings').classList.toggle('hidden');showControls();};
document.querySelector('#closeSettings').onclick=()=>document.querySelector('#settings').classList.add('hidden');
document.querySelector('#offset').oninput=e=>{offset=Number(e.target.value)||0;scrollLyrics();};
function applyFontSize(val){
  document.documentElement.style.setProperty('--active-size',val+'px');
  // iOS Safari 需要强制重排才能让动态CSS变量生效
  void document.body.offsetHeight;
  // 下一帧重新计算歌词位置，确保字号变化后布局同步
  requestAnimationFrame(()=>scrollLyrics());
}
const fontSizeSel=document.querySelector('#fontSize');
fontSizeSel.addEventListener('change',e=>{
  applyFontSize(e.target.value);
  const valEl=document.querySelector('#fontSizeVal');
  if(valEl)valEl.textContent=e.target.value;
  localStorage.setItem('juzi_fontSize',e.target.value);
});
fontSizeSel.addEventListener('input',e=>{
  applyFontSize(e.target.value);
  const valEl=document.querySelector('#fontSizeVal');
  if(valEl)valEl.textContent=e.target.value;
});
document.querySelector('#logoToggle').onchange=e=>{
  logoBg.classList.toggle('hide',!e.target.checked);
  localStorage.setItem('juzi_logoShow',e.target.checked);
};
document.querySelector('#logoScale').addEventListener('input',e=>{
  const val=Number(e.target.value);
  document.documentElement.style.setProperty('--logo-scale',val);
  document.querySelector('#logoScaleVal').textContent=val.toFixed(1);
  localStorage.setItem('juzi_logoScale',val);
});
document.querySelector('#countdownSel').onchange=e=>{countdownSec=Number(e.target.value);localStorage.setItem('juzi_countdown',e.target.value);};
document.querySelector('#titleSplashToggle').onchange=e=>{titleSplashEnabled=e.target.checked;localStorage.setItem('juzi_titleSplash',e.target.checked);};
document.querySelector('#interactiveToggle').onchange=e=>{
  interactiveMode=e.target.checked;
  const legend=document.querySelector('#interactiveLegend');
  if(interactiveMode)legend.classList.remove('hidden');
  else legend.classList.add('hidden');
  localStorage.setItem('juzi_interactive',e.target.checked);
  if(current.lyrics.length)buildLyrics();
};

/* ===== 锁定控制栏 ===== */
let isLocked=false;
const unlockBtn=document.querySelector('#unlockBtn');
document.querySelector('#lockBtn').onclick=e=>{
  e.stopPropagation();
  isLocked=true;
  controls.classList.add('hiddenBar');
  searchPanel.classList.add('hiddenBar');
  unlockBtn.classList.remove('hidden');
  if(hideTimer)clearTimeout(hideTimer);
};
unlockBtn.onclick=e=>{
  e.stopPropagation();
  isLocked=false;
  controls.classList.remove('hiddenBar');
  searchPanel.classList.remove('hiddenBar');
  unlockBtn.classList.add('hidden');
  controls.style.opacity='1';
  controls.style.transform='translateY(0)';
  controls.style.maxHeight='200px';
  origShowControls();
  resetHideTimer();
};
// 锁定状态下不唤出控制栏
const origShowControls=showControls;
showControls=function(){if(!isLocked)origShowControls();};

/* ===== 电脑键盘快捷键 ===== */
document.addEventListener('keydown',e=>{
  // 输入框聚焦时不触发快捷键
  const tag=e.target.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;

  switch(e.key){
    case ' ':
      e.preventDefault();
      togglePlay();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      seekBy(-0.5);
      break;
    case 'ArrowRight':
      e.preventDefault();
      seekBy(0.5);
      break;
    case 'f':
    case 'F':
      document.querySelector('#fullBtn').click();
      break;
    case 'l':
    case 'L':
      document.querySelector('#lockBtn').click();
      break;
    case 's':
    case 'S':
      document.querySelector('#searchToggleBtn').click();
      break;
    case 'p':
    case 'P':
      openPlaylist();
      break;
    case 'm':
    case 'M':
      openMyPlaylist();
      break;
    case 'c':
    case 'C':
      document.querySelector('#clearBtn').click();
      break;
    case 'Escape':
      // 关闭所有打开的面板
      if(!myPlaylistPanel.classList.contains('hidden'))closeMyPlaylist();
      else if(!playlistPanel.classList.contains('hidden'))closePlaylist();
      else if(!document.querySelector('#settings').classList.contains('hidden'))document.querySelector('#closeSettings').click();
      else if(!scanModal.classList.contains('hidden'))closeScan();
      else if(document.fullscreenElement||document.webkitFullscreenElement){
        if(document.exitFullscreen)document.exitFullscreen().catch(()=>{});
        else if(document.webkitExitFullscreen)document.webkitExitFullscreen();
      }
      break;
  }
});

/* ===== 初始化 ===== */
applyFontSize('38');
loadPlaylists();
loadLocalSongs();
buildLyrics();
updateUI();

/* ===== 扫码导入歌单（URL hash #pl=base64） ===== */
(function checkImportFromUrl(){
  const hash=location.hash;
  const m=hash.match(/#pl=(.+)/);
  if(!m)return;
  try{
    const decoded=decodeURIComponent(escape(atob(m[1])));
    const parts=decoded.split('||');
    const name=parts[0]||'扫码导入歌单';
    const songs=[];
    const matched=[],unmatched=[];
    for(let i=1;i<parts.length;i++){
      const sp=parts[i].split(' - ');
      if(sp.length>=2){
        const artist=sp[0].trim();
        const title=sp.slice(1).join(' - ').trim();
        const match=localSongs.find(s=>s.artist===artist&&s.title===title);
        if(match){songs.push({artist,title});matched.push(artist+' - '+title);}
        else{unmatched.push(artist+' - '+title);}
      }
    }
    if(songs.length){
      const pl={id:Date.now(),name,songs,mode:'auto',interval:3};
      playlists.push(pl);
      savePlaylists();
      setTimeout(()=>{
        let msg=`已扫码导入歌单"${name}"，共${songs.length}首`;
        if(unmatched.length)msg+=`，${unmatched.length}首未匹配`;
        alert(msg);
        // 清空hash，避免刷新重复导入
        history.replaceState(null,'',location.pathname+location.search);
      },1500);
    }
  }catch(e){console.error('扫码导入失败',e);}
})();

/* ===== 当前播放列表（酷狗风格） ===== */
const playingListBtn=document.querySelector('#playingListBtn');
const playingListPanel=document.querySelector('#playingListPanel');
const playingListOverlay=document.querySelector('#playingListOverlay');
const playingListSongs=document.querySelector('#playingListSongs');
const closePlayingListBtn=document.querySelector('#closePlayingList');
const plTitle=document.querySelector('#plTitle');

function showPlayingList(){
  if(!currentPlaylist||!playlistPlaying)return;
  plTitle.textContent='📜 '+(currentPlaylist.name||'播放列表')+'（'+currentPlaylist.songs.length+'首）';
  renderPlayingList();
  playingListPanel.classList.add('show');playingListPanel.classList.remove('hidden');
  playingListOverlay.classList.remove('hidden');
}
function hidePlayingList(){
  playingListPanel.classList.remove('show');playingListPanel.classList.add('hidden');
  playingListOverlay.classList.add('hidden');
}
function renderPlayingList(){
  if(!currentPlaylist)return;
  playingListSongs.innerHTML='';
  currentPlaylist.songs.forEach((s,i)=>{
    const item=document.createElement('div');
    item.className='plSongItem'+(i===currentSongIndex?' active':'');
    item.innerHTML='<div><div class="plSongTitle">'+s.title+'</div><div class="plSongArtist">'+s.artist+'</div></div>'+(i===currentSongIndex?'<span style="color:#4fc3f7">▶</span>':'');
    item.onclick=()=>{
      currentSongIndex=i;
      hidePlayingList();
      playSongInPlaylist();
    };
    playingListSongs.appendChild(item);
  });
  // 滚动到当前歌曲
  const activeEl=playingListSongs.querySelector('.active');
  if(activeEl)activeEl.scrollIntoView({block:'center'});
}
playingListBtn.onclick=e=>{e.stopPropagation();showPlayingList();};
closePlayingListBtn.onclick=e=>{e.stopPropagation();hidePlayingList();};
playingListOverlay.onclick=hidePlayingList;

// 播放歌单时显示播放列表按钮
const origPlayPlaylist=playPlaylist;
playPlaylist=function(idx){
  origPlayPlaylist(idx);
  playingListBtn.style.display='';
};
const origNextSong=nextSong;
nextSong=function(){
  origNextSong();
  renderPlayingList();
};
const origPrevSong=prevSong;
prevSong=function(){
  origPrevSong();
  renderPlayingList();
};
/* ===== 手机遥控器（MQTT中转） ===== */
const remoteBtn=document.querySelector('#remoteBtn');
const remotePairPanel=document.querySelector('#remotePairPanel');
const closeRemotePairBtn=document.querySelector('#closeRemotePair');
const remoteQRCode=document.querySelector('#remoteQRCode');
const remotePeerIdEl=document.querySelector('#remotePeerId');
const remoteStatusEl=document.querySelector('#remoteStatus');

let mqttClient=null;
let roomId='';
let isRemoteMode=false;

// 检查是否是遥控器模式（URL带?remote=xxx，或上次连接过自动恢复）
(function checkRemoteMode(){
  const params=new URLSearchParams(location.search);
  let remoteId=params.get('remote');
  // 如果URL没带，但localStorage有保存的，自动用上次的
  if(!remoteId)remoteId=localStorage.getItem('juzi_remoteRoom');
  if(!remoteId)return;
  isRemoteMode=true;
  roomId=remoteId;
  // 保存到localStorage，下次自动连
  localStorage.setItem('juzi_remoteRoom',remoteId);
  // 隐藏所有界面，只显示控制界面
  document.body.innerHTML='';
  const app=document.createElement('div');
  app.style.cssText='display:flex;flex-direction:column;align-items:center;height:100vh;background:#0b0b0b;color:#fff;padding:16px;gap:16px;overflow-y:auto;';
  app.innerHTML=`
    <h2 style="margin:0 0 8px 0">🎮 遥控器</h2>
    <p id="rSong" style="color:#4fc3f7;margin:0;font-size:16px;">等待连接...</p>
    
    <!-- 进度条 -->
    <div style="width:100%;max-width:400px;">
      <input type="range" id="rProgress" min="0" max="100" value="0" step="0.1" style="width:100%;">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#888;">
        <span id="rCurTime">00:00</span>
        <span id="rTotalTime">00:00</span>
      </div>
    </div>
    
    <!-- 播放控制 -->
    <div style="display:flex;gap:20px;align-items:center;margin:10px 0;">
      <button id="rPrev" style="width:60px;height:60px;border-radius:50%;border:none;background:#333;color:#fff;font-size:22px;cursor:pointer;">⏮</button>
      <button id="rPlay" style="width:80px;height:80px;border-radius:50%;border:none;background:#4fc3f7;color:#000;font-size:32px;cursor:pointer;">▶</button>
      <button id="rNext" style="width:60px;height:60px;border-radius:50%;border:none;background:#333;color:#fff;font-size:22px;cursor:pointer;">⏭</button>
    </div>
    
    <!-- 快进快退 -->
    <div style="display:flex;gap:10px;">
      <button data-cmd="seek-back" style="padding:10px 16px;border-radius:8px;border:none;background:#333;color:#fff;font-size:14px;cursor:pointer;">⏪ -0.5s</button>
      <button data-cmd="seek-forward" style="padding:10px 16px;border-radius:8px;border:none;background:#333;color:#fff;font-size:14px;cursor:pointer;">+0.5s ⏩</button>
    </div>
    
    <!-- 字号调整 -->
    <div style="display:flex;gap:10px;align-items:center;">
      <button data-cmd="font-down" style="width:44px;height:44px;border-radius:8px;border:none;background:#333;color:#fff;font-size:18px;cursor:pointer;">A-</button>
      <span style="color:#888;font-size:14px;">字号</span>
      <button data-cmd="font-up" style="width:44px;height:44px;border-radius:8px;border:none;background:#333;color:#fff;font-size:18px;cursor:pointer;">A+</button>
    </div>
    
    <!-- 功能按钮 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%;max-width:400px;margin-top:10px;">
      <button data-cmd="fullscreen" style="padding:12px;border-radius:10px;border:none;background:#333;color:#fff;font-size:14px;cursor:pointer;">⛶ 全屏</button>
      <button data-cmd="lock" style="padding:12px;border-radius:10px;border:none;background:#333;color:#fff;font-size:14px;cursor:pointer;">🔒 锁定</button>
      <button data-cmd="clear" style="padding:12px;border-radius:10px;border:none;background:#333;color:#fff;font-size:14px;cursor:pointer;">🗑 清空</button>
      <button id="rShowPlaylist" style="padding:12px;border-radius:10px;border:none;background:#333;color:#fff;font-size:14px;cursor:pointer;">📜 列表</button>
      <button id="rShowSearch" style="padding:12px;border-radius:10px;border:none;background:#333;color:#fff;font-size:14px;cursor:pointer;">🔍 搜索</button>
      <button id="rShowSettings" style="padding:12px;border-radius:10px;border:none;background:#333;color:#fff;font-size:14px;cursor:pointer;">⚙️ 设置</button>
      <button id="rShowLucky" style="padding:12px;border-radius:10px;border:none;background:#f36b0a;color:#fff;font-size:14px;cursor:pointer;grid-column:span 2;">🎲 抽奖模式</button>
    </div>
    
    <!-- 倒计时设置 -->
    <div style="display:flex;gap:8px;align-items:center;margin-top:8px;">
      <span style="color:#888;font-size:14px;">倒计时:</span>
      <button data-cmd="countdown-0" style="padding:8px 12px;border-radius:6px;border:none;background:#333;color:#fff;font-size:13px;cursor:pointer;">关</button>
      <button data-cmd="countdown-3" style="padding:8px 12px;border-radius:6px;border:none;background:#333;color:#fff;font-size:13px;cursor:pointer;">3s</button>
      <button data-cmd="countdown-5" style="padding:8px 12px;border-radius:6px;border:none;background:#333;color:#fff;font-size:13px;cursor:pointer;">5s</button>
      <button data-cmd="countdown-10" style="padding:8px 12px;border-radius:6px;border:none;background:#333;color:#fff;font-size:13px;cursor:pointer;">10s</button>
    </div>
    
    <!-- 搜索面板（默认隐藏） -->
    <div id="rSearchPanel" style="width:100%;max-width:400px;margin-top:10px;display:none;">
      <input id="rSearch" placeholder="搜索歌曲..." style="width:100%;padding:10px;border-radius:8px;border:none;background:#222;color:#fff;font-size:14px;box-sizing:border-box;">
      <div id="rSearchResults" style="margin-top:8px;max-height:200px;overflow-y:auto;"></div>
      <button id="rPlaySelected" style="width:100%;padding:12px;border-radius:8px;border:none;background:#4fc3f7;color:#000;font-size:15px;font-weight:bold;cursor:pointer;margin-top:8px;">▶ 播放选中歌曲</button>
    </div>
    
    <!-- 播放列表面板（默认隐藏） -->
    <div id="rPlaylistPanel" style="width:100%;max-width:400px;margin-top:10px;display:none;">
      <div id="rPlaylistSongs" style="max-height:300px;overflow-y:auto;background:#222;border-radius:8px;padding:8px;">
        <p style="color:#888;text-align:center;">正在加载...</p>
      </div>
    </div>
    
    <!-- 设置面板（默认隐藏） -->
    <div id="rSettingsPanel" style="width:100%;max-width:400px;margin-top:10px;display:none;background:#222;border-radius:8px;padding:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="color:#fff;font-size:14px;">显示Logo</span>
        <button data-cmd="toggle-logo" id="rLogoToggle" style="padding:6px 12px;border-radius:6px;border:none;background:#4fc3f7;color:#000;font-size:13px;cursor:pointer;">开</button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="color:#fff;font-size:14px;">Logo大小</span>
        <input type="range" id="rLogoScale" min="0.5" max="3" step="0.1" value="1" style="width:120px;">
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="color:#fff;font-size:14px;">全屏歌名</span>
        <button data-cmd="toggle-title-splash" id="rTitleSplashToggle" style="padding:6px 12px;border-radius:6px;border:none;background:#444;color:#fff;font-size:13px;cursor:pointer;">关</button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="color:#fff;font-size:14px;">互动模式</span>
        <button data-cmd="toggle-interactive" id="rInteractiveToggle" style="padding:6px 12px;border-radius:6px;border:none;background:#444;color:#fff;font-size:13px;cursor:pointer;">关</button>
      </div>
    </div>
    
    <!-- 抽奖面板（完整移植） -->
    <div id="rLuckyPanel" style="width:100%;max-width:400px;margin-top:10px;display:none;">
      <div style="background:#1a1a1a;border-radius:12px;padding:16px;">
        <button id="rLuckyStart" style="width:100%;padding:16px;border-radius:12px;border:none;background:#f36b0a;color:#fff;font-size:18px;font-weight:700;cursor:pointer;margin-bottom:10px;">🎲 开始抽奖</button>
        <button id="rLuckyStop" style="width:100%;padding:16px;border-radius:12px;border:none;background:#333;color:#fff;font-size:18px;font-weight:700;cursor:pointer;margin-bottom:10px;display:none;">⏹ 停止！</button>
        <button id="rLuckyPlay" style="width:100%;padding:16px;border-radius:12px;border:none;background:#4caf50;color:#fff;font-size:18px;font-weight:700;cursor:pointer;margin-bottom:10px;display:none;">▶ 播放抽中歌曲</button>
        <button id="rLuckyAgain" style="width:100%;padding:14px;border-radius:12px;border:none;background:#f36b0a;color:#fff;font-size:16px;font-weight:700;cursor:pointer;margin-bottom:10px;display:none;">🎲 再抽一次</button>
        <div style="display:flex;gap:4px;margin-bottom:12px;">
          <button class="luckyTabBtn active" data-tab="artist" style="flex:1;padding:8px;border-radius:8px;border:none;background:#f36b0a;color:#fff;font-size:12px;cursor:pointer;">按歌手选</button>
          <button class="luckyTabBtn" data-tab="search" style="flex:1;padding:8px;border-radius:8px;border:none;background:#333;color:#fff;font-size:12px;cursor:pointer;">搜索选</button>
          <button class="luckyTabBtn" data-tab="selected" style="flex:1;padding:8px;border-radius:8px;border:none;background:#333;color:#fff;font-size:12px;cursor:pointer;">已选(<span id="selCount">0</span>)</button>
          <button class="luckyTabBtn" data-tab="played" style="flex:1;padding:8px;border-radius:8px;border:none;background:#333;color:#fff;font-size:12px;cursor:pointer;">已唱</button>
        </div>
        <div id="luckyArtistTab"><div id="luckyArtistGrid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;"></div><div id="luckyArtistSongs" style="display:none;max-height:300px;overflow-y:auto;"></div></div>
        <div id="luckySearchTab" style="display:none;margin-bottom:10px;">
          <input id="luckySearchInput" placeholder="搜歌名/歌手/拼音(fssx=富士山下)" style="width:100%;padding:10px;border-radius:8px;border:none;background:#222;color:#fff;font-size:14px;box-sizing:border-box;margin-bottom:8px;">
          <div id="luckySearchResults" style="max-height:300px;overflow-y:auto;"></div>
        </div>
        <div id="luckySelectedTab" style="display:none;">
          <button onclick="luckyClearSelected()" style="width:100%;padding:10px;border-radius:8px;border:none;background:#ff4444;color:#fff;font-size:13px;cursor:pointer;margin-bottom:8px;">🗑 清空抽奖列表</button>
          <div style="font-size:13px;color:#888;margin-bottom:8px;">点歌曲可删除，共<span id="selCount2">0</span>首</div>
          <div id="luckySelectedList" style="max-height:300px;overflow-y:auto;"></div>
        </div>
        <div id="luckyPlayedTab" style="display:none;">
          <div id="luckyPlayedList" style="max-height:300px;overflow-y:auto;"></div>
        </div>
        <button id="rLuckyClose" style="width:100%;padding:12px;border-radius:10px;border:none;background:#333;color:#888;font-size:14px;cursor:pointer;margin-top:10px;">退出抽奖</button>
      </div>
    </div>
    
    <p id="rStatus" style="color:#888;font-size:13px;margin-top:16px;">正在连接...</p>
  `;
  document.body.appendChild(app);

  // 连接MQTT
  // MQTT连接
  mqttClient=mqtt.connect('wss://haecf9f6.ala.cn-shenzhen.emqxsl.cn:8084/mqtt',{
    clientId:'juzi_remote_'+Math.random().toString(16).slice(2,8),username:'juzi',password:'Lian0708',
    connectTimeout:5000,
    reconnectPeriod:3000,
    clean:true
  });
  mqttClient.on('connect',()=>{
    document.querySelector('#rStatus').textContent='✅ 已连接！正在加载歌单...';
    document.querySelector('#rStatus').style.color='#4fc3f7';
    mqttClient.subscribe('juzi/'+roomId+'/state');
    window.remoteAllSongs=[];
    fetch('data/songs.json').then(r=>r.json()).then(songs=>{
      window.remoteAllSongs=songs;
      document.querySelector('#rStatus').textContent='✅ 已连接！共'+songs.length+'首歌';
    }).catch(e=>{
      document.querySelector('#rStatus').textContent='❌ 歌单加载失败';
    });
    mqttClient.publish('juzi/'+roomId+'/cmd',JSON.stringify({type:'remote-connected'}));
    // 主动请求已唱列表
    mqttClient.publish('juzi/'+roomId+'/cmd',JSON.stringify({type:'get-played'}));
  });
  let remotePlayed=JSON.parse(localStorage.getItem('luckyPlayed')||'[]');
  mqttClient.on('message',(topic,msg)=>{
    try{
      const data=JSON.parse(msg.toString());
      if(data.type==='playState'){
        document.querySelector('#rPlay').textContent=data.playing?'⏸':'▶';
        document.querySelector('#rSong').textContent=data.song||'未知歌曲';
      }
      if(data.type==='timeUpdate'){
        document.querySelector('#rCurTime').textContent=data.cur||'00:00';
        document.querySelector('#rTotalTime').textContent=data.total||'00:00';
        if(!rDragging){
          document.querySelector('#rProgress').value=data.progress||0;
        }
      }
      if(data.type==='playlistData'){
        const plDiv=document.querySelector('#rPlaylistSongs');
        plDiv.innerHTML='';
        if(!data.songs||data.songs.length===0){
          plDiv.innerHTML='<p style="color:#888;text-align:center;">当前没有歌单</p>';
          return;
        }
        data.songs.forEach((s,i)=>{
          const item=document.createElement('div');
          item.style.cssText='padding:10px;border-bottom:1px solid #333;cursor:pointer;color:#fff;font-size:14px;'+(i===data.current?'color:#4fc3f7;font-weight:bold;':'');
          item.textContent=(i+1)+'. '+s.title+' - '+s.artist;
          item.onclick=()=>{
            sendCmd('play-playlist-song',{index:i});
          };
          plDiv.appendChild(item);
        });
      }
      // 抽奖已唱同步
      if(data.type==='played-list'){
        remotePlayed=data.songs||[];
        renderLuckyPlayed();
      }
      if(data.type==='new-played'){
        remotePlayed.push(data.song);
        // 从抽奖池删除
        const k=luckyKey(data.song);
        luckySelected.delete(k);
        renderLuckySelected();
        renderLuckyPlayed();
        saveLuckyPlayed();
      }
    }catch(e){
      console.error('消息处理错误:',e);
    }
  });
  mqttClient.on('error',()=>{
    document.querySelector('#rStatus').textContent='❌ 连接失败，3秒后重连...';
    document.querySelector('#rStatus').style.color='#f44';
  });
  mqttClient.on('close',()=>{
    document.querySelector('#rStatus').textContent='⚠️ 连接断开，3秒后重连...';
    document.querySelector('#rStatus').style.color='#f44';
    setTimeout(()=>location.reload(),3000);
  });

  let rDragging=false;
  function sendCmd(cmd,payload){
    if(mqttClient&&mqttClient.connected){
      mqttClient.publish('juzi/'+roomId+'/cmd',JSON.stringify({type:cmd,payload:payload||{}}));
    }
  }

  // 按钮事件
  document.querySelector('#rPrev').onclick=()=>sendCmd('prev');
  document.querySelector('#rNext').onclick=()=>sendCmd('next');
  document.querySelector('#rPlay').onclick=()=>sendCmd('playpause');

  document.querySelectorAll('[data-cmd]').forEach(btn=>{
    btn.onclick=()=>sendCmd(btn.dataset.cmd);
  });

  // 面板切换
  const searchPanel=document.querySelector('#rSearchPanel');
  const playlistPanel=document.querySelector('#rPlaylistPanel');
  document.querySelector('#rShowSearch').onclick=()=>{
    if(searchPanel.style.display==='none'||!searchPanel.style.display){
      searchPanel.style.display='block';
      playlistPanel.style.display='none';
    }else{
      searchPanel.style.display='none';
    }
  };
  document.querySelector('#rShowPlaylist').onclick=()=>{
    if(playlistPanel.style.display==='none'||!playlistPanel.style.display){
      playlistPanel.style.display='block';
      searchPanel.style.display='none';
      document.querySelector('#rSettingsPanel').style.display='none';
      sendCmd('get-playlist');
    }else{
      playlistPanel.style.display='none';
    }
  };
  // 抽奖模式（完整移植独立抽奖）
  let luckySelected=new Map(JSON.parse(localStorage.getItem('luckyPool')||'[]'));
  const LUCKY_ARTISTS=['陈奕迅','容祖儿','杨千嬅','邓紫棋','蔡依林','梁静茹','张惠妹','A-Lin','郭静','徐佳莹','刘若英','孙燕姿','田馥甄','杨丞琳','谢安琪','陈慧娴','郑秀文','吴雨霏','周杰伦','林俊杰'];
  const LUCKY_HOT={
    '陈奕迅':['十年','爱情转移','红玫瑰','富士山下','浮夸','K歌之王','最佳损友','陀飞轮','任我行','苦瓜','单车','你的背包','明年今日','葡萄成熟时','夕阳无限好','人来人往','十面埋伏','绵绵','岁月如歌','好久不见','淘汰'],
    '容祖儿':['心淡','习惯失恋','16号爱人','烟霞','天窗','破相','花千树','隆重登场','争气','痛爱','借过','世上只有','特别嘉宾','我的骄傲','想得太远'],
    '杨千嬅':['可惜我是水瓶座','野孩子','勇','少女的祈祷','再见二丁目','小城大事','处处吻','飞女正传','烈女','姊妹','火鸟'],
    '邓紫棋':['泡沫','后会无期','光年之外','喜欢你','倒数','多远都要在一起'],
    '蔡依林':['倒带','妥协','我知道你很难过','日不落','舞娘','说爱你','玫瑰少年','柠檬草的味道'],
    '梁静茹':['情歌','会呼吸的痛','可惜不是你','勇气','宁夏','崇拜'],
    '张惠妹':['记得','剪爱','听海','我最亲爱的','连名带姓','如果你也听说'],
    'A-Lin':['给我一个理由忘记','有一种悲伤','挚友'],
    '郭静':['下一个天亮','心墙','在树上唱歌'],
    '徐佳莹':['失落沙洲','身骑白马','言不由衷','最初的记忆'],
    '刘若英':['后来','成全','很爱很爱你','为爱痴狂','当爱在靠近'],
    '孙燕姿':['遇见','开始懂了','绿光','天黑黑','我怀念的','逆光'],
    '田馥甄':['小幸运','爱了很久的朋友','你就不要想起我','寂寞寂寞就好','魔鬼中的天使'],
    '杨丞琳':['暧昧','雨爱','左边','带我走','年轮说','不被祝福的幸福'],
    '谢安琪':['喜帖街','钟无艳','年度之歌'],
    '陈慧娴':['千千阙歌','飘雪','夜机','傻女','红茶馆'],
    '郑秀文':['终身美丽','默契','舍不得你','值得','眉飞色舞'],
    '吴雨霏':['吴哥窟','生命树','明知做戏','逼得太紧','我本人','街灯晚餐'],
    '周杰伦':['晴天','七里香','最长的电影','搁浅','枫','说好的幸福呢','等你下课','退后','花海','安静','简单爱','青花瓷','一路向北'],
    '林俊杰':['江南','一千年以后','曹操','小酒窝','修炼爱情','那些你很冒险的梦','背对背拥抱','她说','醉赤壁','记得']
  };
  function luckyKey(s){return s.title+'|||'+s.artist;}
  function renderLuckyArtistGrid(){
    const grid=document.querySelector('#luckyArtistGrid');
    grid.innerHTML='';
    LUCKY_ARTISTS.forEach(a=>{
      const card=document.createElement('div');
      card.style.cssText='text-align:center;cursor:pointer;padding:8px;border-radius:8px;background:#222;';
      card.innerHTML=`<img src="https://juzi-lyrics.pages.dev/assets/${a}.jpg" onerror="this.style.display='none'" style="width:40px;height:40px;border-radius:50%;object-fit:cover;margin:0 auto 4px;"><div style="font-size:11px;color:#ccc;">${a}</div>`;
      card.onclick=()=>showLuckyArtist(a);
      grid.appendChild(card);
    });
  }
  function showLuckyArtist(a){
    document.querySelector('#luckyArtistGrid').style.display='none';
    const box=document.querySelector('#luckyArtistSongs');
    box.style.display='block';
    box.innerHTML=`<button onclick="backToLuckyArtists()" style="width:100%;padding:8px;border-radius:6px;border:none;background:#333;color:#fff;font-size:12px;cursor:pointer;margin-bottom:8px;">← 返回歌手列表</button><button onclick="luckyAddHot('${a}')" style="width:100%;padding:10px;border-radius:8px;border:none;background:#f36b0a;color:#fff;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px;">🔥 一键加热门精选</button><button onclick="luckyAddAll('${a}')" style="width:100%;padding:8px;border-radius:6px;border:none;background:#333;color:#aaa;font-size:12px;cursor:pointer;margin-bottom:8px;">全选此歌手所有歌</button>`;
    const list=(window.remoteAllSongs||[]).filter(s=>s.artist.includes(a));
    list.forEach(s=>{
      const k=luckyKey(s);
      const div=document.createElement('div');
      div.style.cssText='padding:10px;border-bottom:1px solid #333;font-size:13px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;';
      div.innerHTML=`<span>${s.title} - ${s.artist}</span><span style="color:#f36b0a;">${luckySelected.has(k)?'✓':'+'}</span>`;
      div.onclick=()=>toggleLuckySelect(s);
      box.appendChild(div);
    });
  }
  window.backToLuckyArtists=()=>{
    document.querySelector('#luckyArtistGrid').style.display='grid';
    document.querySelector('#luckyArtistSongs').style.display='none';
  };
  window.luckyAddHot=(a)=>{
    const hot=LUCKY_HOT[a]||[];
    (window.remoteAllSongs||[]).filter(s=>hot.includes(s.title)&&s.artist.includes(a)).forEach(s=>luckySelected.set(luckyKey(s),s));
    renderLuckySelected();
    showLuckyArtist(a);
  };
  window.luckyAddAll=(a)=>{
    (window.remoteAllSongs||[]).filter(s=>s.artist.includes(a)).forEach(s=>luckySelected.set(luckyKey(s),s));
    renderLuckySelected();
    showLuckyArtist(a);
  };
  function toggleLuckySelect(s){
    const k=luckyKey(s);
    if(luckySelected.has(k))luckySelected.delete(k);else luckySelected.set(k,s);
    renderLuckySelected();
  }
  function renderLuckySearch(q){
    const f=q.trim().toLowerCase();
    const el=document.querySelector('#luckySearchResults');
    if(!f){el.innerHTML='<div style="text-align:center;color:#666;padding:30px;font-size:13px;">输入歌名/歌手/拼音搜索</div>';return;}
    const results=(window.remoteAllSongs||[]).filter(s=>{
      if(s.title.toLowerCase().includes(f)||s.artist.toLowerCase().includes(f))return true;
      if(/^[a-z]+$/.test(f)&&s._py&&s._py.startsWith(f))return true;
      return false;
    }).slice(0,50);
    el.innerHTML='';
    results.forEach(s=>{
      const k=luckyKey(s);
      const div=document.createElement('div');
      div.style.cssText='padding:10px;border-bottom:1px solid #333;font-size:13px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;';
      div.innerHTML=`<span>${s.title} - ${s.artist}</span><span style="color:#f36b0a;">${luckySelected.has(k)?'✓':'+'}</span>`;
      div.onclick=()=>toggleLuckySelect(s);
      el.appendChild(div);
    });
  }
  function saveLuckyPool(){
    localStorage.setItem('luckyPool',JSON.stringify(Array.from(luckySelected.entries())));
  }
  function saveLuckyPlayed(){
    localStorage.setItem('luckyPlayed',JSON.stringify(remotePlayed));
  }
  function renderLuckySelected(){
    saveLuckyPool();
    document.querySelector('#selCount').textContent=luckySelected.size;
    document.querySelector('#selCount2').textContent=luckySelected.size;
    const el=document.querySelector('#luckySelectedList');
    el.innerHTML='';
    luckySelected.forEach((s,k)=>{
      const div=document.createElement('div');
      div.style.cssText='padding:10px;border-bottom:1px solid #333;font-size:13px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;';
      div.innerHTML=`<span>${s.title} - ${s.artist}</span><span style="color:#ff6b6b;font-size:12px;">✕ 删除</span>`;
      div.onclick=()=>{luckySelected.delete(k);renderLuckySelected();};
      el.appendChild(div);
    });
  }
  window.luckyClearSelected=()=>{
    if(confirm('确定清空整个抽奖列表？')){
      luckySelected.clear();
      renderLuckySelected();
    }
  };
  function renderLuckyPlayed(){
    console.log('renderLuckyPlayed called, count:',remotePlayed.length);
    const el=document.querySelector('#luckyPlayedList');
    if(!el){console.log('luckyPlayedList element not found');return;}
    let html='';
    if(remotePlayed.length===0){
      html='<div style="text-align:center;color:#666;padding:30px;font-size:13px;">还没抽过歌</div>';
    }else{
      remotePlayed.forEach((s,i)=>{
        html+='<div style="padding:10px;border-bottom:1px solid #333;font-size:13px;color:#fff;">'+(i+1)+'. '+s.title+' - '+s.artist+'</div>';
      });
    }
    el.innerHTML=html;
  }
  // tab切换
  document.querySelectorAll('.luckyTabBtn').forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll('.luckyTabBtn').forEach(b=>{b.classList.remove('active');b.style.background='#333';});
      btn.classList.add('active');btn.style.background='#f36b0a';
      const t=btn.dataset.tab;
      document.querySelector('#luckyArtistTab').style.display=t==='artist'?'block':'none';
      document.querySelector('#luckySearchTab').style.display=t==='search'?'block':'none';
      document.querySelector('#luckySelectedTab').style.display=t==='selected'?'block':'none';
      document.querySelector('#luckyPlayedTab').style.display=t==='played'?'block':'none';
      if(t==='selected')renderLuckySelected();
      if(t==='played')renderLuckyPlayed();
    };
  });
  document.querySelector('#luckySearchInput').oninput=(e)=>renderLuckySearch(e.target.value);
  document.querySelector('#rShowLucky').onclick=()=>{
    document.querySelector('#rLuckyPanel').style.display='block';
    document.querySelector('#rSearchPanel').style.display='none';
    document.querySelector('#rPlaylistPanel').style.display='none';
    document.querySelector('#rSettingsPanel').style.display='none';
    renderLuckyArtistGrid();
    // 通知电脑打开抽奖页面
    mqttClient.publish('juzi/'+remoteId+'/cmd',JSON.stringify({type:'lucky-open'}));
  };
  document.querySelector('#rLuckyClose').onclick=()=>{
    document.querySelector('#rLuckyPanel').style.display='none';
    mqttClient.publish('juzi/'+remoteId+'/cmd',JSON.stringify({type:'lucky-exit'}));
  };
  document.querySelector('#rLuckyStart').onclick=()=>{
    if(luckySelected.size===0){alert('先选歌！');return;}
    const songs=Array.from(luckySelected.values());
    mqttClient.publish('juzi/'+remoteId+'/cmd',JSON.stringify({type:'lucky-start',songs:songs}));
    document.querySelector('#rLuckyStart').style.display='none';
    document.querySelector('#rLuckyStop').style.display='block';
  };
  document.querySelector('#rLuckyStop').onclick=()=>{
    mqttClient.publish('juzi/'+remoteId+'/cmd',JSON.stringify({type:'lucky-stop'}));
    document.querySelector('#rLuckyStop').style.display='none';
    document.querySelector('#rLuckyPlay').style.display='block';
    document.querySelector('#rLuckyAgain').style.display='block';
  };
  document.querySelector('#rLuckyPlay').onclick=()=>{
    mqttClient.publish('juzi/'+remoteId+'/cmd',JSON.stringify({type:'lucky-play'}));
    document.querySelector('#rLuckyPlay').style.display='none';
    document.querySelector('#rLuckyAgain').style.display='none';
    document.querySelector('#rLuckyStart').style.display='block';
  };
  document.querySelector('#rLuckyAgain').onclick=()=>{
    mqttClient.publish('juzi/'+remoteId+'/cmd',JSON.stringify({type:'lucky-start',songs:Array.from(luckySelected.values())}));
    document.querySelector('#rLuckyPlay').style.display='none';
    document.querySelector('#rLuckyAgain').style.display='none';
    document.querySelector('#rLuckyStart').style.display='none';
    document.querySelector('#rLuckyStop').style.display='block';
  };
  document.querySelector('#rLuckyPlay').onclick=()=>{
    mqttClient.publish('juzi/'+remoteId+'/cmd',JSON.stringify({type:'lucky-play'}));
    document.querySelector('#rLuckyPlay').style.display='none';
    document.querySelector('#rLuckyStart').style.display='block';
  };
  document.querySelector('#rShowSettings').onclick=()=>{
    const sp=document.querySelector('#rSettingsPanel');
    if(sp.style.display==='none'||!sp.style.display){
      sp.style.display='block';
      playlistPanel.style.display='none';
      searchPanel.style.display='none';
    }else{
      sp.style.display='none';
    }
  };
  // logo大小调节
  document.querySelector('#rLogoScale').oninput=(e)=>{
    sendCmd('set-logo-scale',{value:parseFloat(e.target.value)});
  };

  // 搜索输入
  const searchInput=document.querySelector('#rSearch');
  searchInput.oninput=()=>{
    const q=searchInput.value.trim().toLowerCase();
    const searchResults=document.querySelector('#rSearchResults');
    if(!q){
      searchResults.innerHTML='';
      return;
    }
    // 本地搜索
    const all=window.remoteAllSongs||[];
    if(all.length===0){
      searchResults.innerHTML='<p style="color:#888;text-align:center;">歌单加载中，请稍等...</p>';
      return;
    }
    const results=all.filter(s=>
      s.title.toLowerCase().includes(q)||s.artist.toLowerCase().includes(q)
    ).slice(0,20);
    searchResults.innerHTML='';
    if(results.length===0){
      searchResults.innerHTML='<p style="color:#888;text-align:center;">没找到歌曲</p>';
      return;
    }
    results.forEach(s=>{
      const item=document.createElement('div');
      item.style.cssText='padding:10px;border-bottom:1px solid #333;cursor:pointer;color:#fff;font-size:14px;';
      item.textContent=s.title+' - '+s.artist;
      item.onclick=()=>{
        searchResults.querySelectorAll('div').forEach(d=>d.style.background='');
        item.style.background='#4fc3f7';
        item.dataset.title=s.title;
        item.dataset.artist=s.artist;
      };
      searchResults.appendChild(item);
    });
  };
  // 播放选中歌曲
  document.querySelector('#rPlaySelected').onclick=()=>{
    const selected=document.querySelector('#rSearchResults div[style*="background"]');
    if(!selected){
      alert('请先选择一首歌曲');
      return;
    }
    sendCmd('play-song',{title:selected.dataset.title,artist:selected.dataset.artist,lrc:selected.dataset.lrc});
    document.querySelector('#rSearchResults').innerHTML='';
    searchInput.value='';
  };
  // 设置开关状态反馈
  document.querySelector('#rLogoToggle').onclick=function(){
    if(this.textContent==='开'){this.textContent='关';this.style.background='#444';this.style.color='#fff';}
    else{this.textContent='开';this.style.background='#4fc3f7';this.style.color='#000';}
    sendCmd('toggle-logo');
  };
  document.querySelector('#rTitleSplashToggle').onclick=function(){
    if(this.textContent==='开'){this.textContent='关';this.style.background='#444';this.style.color='#fff';}
    else{this.textContent='开';this.style.background='#4fc3f7';this.style.color='#000';}
    sendCmd('toggle-title-splash');
  };
  document.querySelector('#rInteractiveToggle').onclick=function(){
    if(this.textContent==='开'){this.textContent='关';this.style.background='#444';this.style.color='#fff';}
    else{this.textContent='开';this.style.background='#4fc3f7';this.style.color='#000';}
    sendCmd('toggle-interactive');
  };

  // 进度条拖动
  const progressBar=document.querySelector('#rProgress');
  progressBar.onpointerdown=()=>{rDragging=true;};
  progressBar.onpointerup=()=>{
    rDragging=false;
    sendCmd('seek',{value:parseFloat(progressBar.value)});
  };
})();
// 歌词端：打开配对面板
if(remoteBtn){
  remoteBtn.onclick=()=>{
    remotePairPanel.classList.remove('hidden');
    if(!mqttClient||!mqttClient.connected){
      roomId=Math.random().toString(36).slice(2,8).toUpperCase();
      remotePeerIdEl.textContent=roomId;
      // 生成二维码
      remoteQRCode.innerHTML='';
      const qr=qrcode(0,'M');
      qr.addData(location.origin+location.pathname+'?remote='+roomId);
      qr.make();
      const modules=qr.getModuleCount();
      const cellSize=Math.floor(180/modules);
      let html='<table style="border:0;margin:0 auto;border-collapse:collapse;">';
      for(let r=0;r<modules;r++){
        html+='<tr style="height:'+cellSize+'px;">';
        for(let c=0;c<modules;c++){
          html+='<td style="width:'+cellSize+'px;border:0;padding:0;'+(qr.isDark(r,c)?'background:#000;':'background:#fff;')+'"></td>';
        }
        html+='</tr>';
      }
      html+='</table>';
      remoteQRCode.innerHTML=html;
      // 连接MQTT
      remoteStatusEl.textContent='正在连接服务器...';
      mqttClient=mqtt.connect('wss://haecf9f6.ala.cn-shenzhen.emqxsl.cn:8084/mqtt',{
        clientId:'juzi_host_'+Math.random().toString(16).slice(2,8),username:'juzi',password:'Lian0708',
        connectTimeout:5000,
        reconnectPeriod:3000,
        clean:true
      });
      mqttClient.on('connect',()=>{
        remoteStatusEl.textContent='✅ 等待手机扫码连接...';
        remoteStatusEl.style.color='#4fc3f7';
        mqttClient.subscribe('juzi/'+roomId+'/cmd');
      });
      mqttClient.on('message',(topic,msg)=>{
        const data=JSON.parse(msg.toString());
        handleRemoteCmd(data);
      });
      mqttClient.on('error',()=>{
        remoteStatusEl.textContent='❌ 连接失败，请刷新重试';
        remoteStatusEl.style.color='#f44';
      });
    }
  };
  closeRemotePairBtn.onclick=()=>{
    remotePairPanel.classList.add('hidden');
  };
}

// 歌词端：处理遥控器指令
function handleRemoteCmd(data){
  if(!data||!data.type)return;
  switch(data.type){
    case 'playpause':
      togglePlay();
      if(mqttClient&&mqttClient.connected){
        mqttClient.publish('juzi/'+roomId+'/state',JSON.stringify({
          type:'playState',
          playing:isPlaying(),
          song:current.title+' - '+current.artist
        }));
      }
      break;
    case 'prev':
      prevSong();
      setTimeout(()=>{
        if(mqttClient&&mqttClient.connected){
          mqttClient.publish('juzi/'+roomId+'/state',JSON.stringify({
            type:'playState',
            playing:isPlaying(),
            song:current.title+' - '+current.artist
          }));
        }
      },500);
      break;
    case 'next':
      nextSong();
      setTimeout(()=>{
        if(mqttClient&&mqttClient.connected){
          mqttClient.publish('juzi/'+roomId+'/state',JSON.stringify({
            type:'playState',
            playing:isPlaying(),
            song:current.title+' - '+current.artist
          }));
        }
      },500);
      break;
    case 'seek-back':
      seekBy(-0.5);
      break;
    case 'seek-forward':
      seekBy(0.5);
      break;
    case 'seek':
      if(data.payload&&typeof data.payload.value==='number'){
        const dur=getDuration();
        virtTime=dur*data.payload.value/100;
        updateUI();
      }
      break;
    case 'font-up':
      adjustFontSize(2);
      break;
    case 'font-down':
      adjustFontSize(-2);
      break;
    case 'fullscreen':
      const btn=document.querySelector('#fullBtn');
      if(btn)btn.click();
      break;
    case 'lock':
      const lbtn=document.querySelector('#lockBtn');
      if(lbtn)lbtn.click();
      break;
    case 'clear':
      const cbtn=document.querySelector('#clearBtn');
      if(cbtn)cbtn.click();
      break;
    case 'lucky-open':
      luckyOverlay.classList.remove('hidden');
      document.querySelector('#luckyResult').classList.remove('show');
      document.querySelector('#luckySong').textContent='准备开始';
      document.querySelector('#luckyArtist').textContent='等待手机操作...';
      break;
    case 'lucky-start':
      luckyOverlay.classList.remove('hidden');
      luckyStartRolling(data.songs||localSongs.slice());
      break;
    case 'lucky-stop':
      luckyStopRolling();
      break;
    case 'lucky-play':
      if(window._luckyResult){
        const s=window._luckyResult;
        // 加入已唱
        luckyPlayed.push(s);
        const item=document.createElement('div');
        item.textContent=s.title;
        document.querySelector('#luckyPlayedItems').appendChild(item);
        // 推给遥控器（单个+完整列表都发）
        if(window.mqttClient&&mqttClient.connected){
          mqttClient.publish('juzi/'+roomId+'/state',JSON.stringify({type:'new-played',song:s}));
          mqttClient.publish('juzi/'+roomId+'/state',JSON.stringify({type:'played-list',songs:luckyPlayed}));
        }
        setLocalTrack(s).then(()=>{
          // 渐隐关闭抽奖
          luckyOverlay.style.transition='opacity 0.8s';
          luckyOverlay.style.opacity='0';
          setTimeout(()=>{
            luckyOverlay.classList.add('hidden');
            luckyOverlay.style.opacity='1';
            luckyOverlay.style.transition='';
          },800);
          doPlay();
        });
      }
      break;
    case 'lucky-exit':
      luckyOverlay.classList.add('hidden');
      clearInterval(luckyRollTimer);
      break;
    case 'get-played':
      mqttClient.publish('juzi/'+roomId+'/state',JSON.stringify({type:'played-list',songs:luckyPlayed}));
      break;

    case 'playlist':
      const pbtn=document.querySelector('#playingListBtn');
      if(pbtn)pbtn.click();
      break;
    case 'search':
      const sbtn=document.querySelector('#searchToggleBtn');
      if(sbtn)sbtn.click();
      break;
    case 'remote-connected':
      remotePairPanel.classList.add('hidden');
      break;
    case 'get-all-songs':
      console.log('遥控器请求歌单，当前歌曲数:',localSongs.length);
      if(mqttClient&&mqttClient.connected){
        mqttClient.publish('juzi/'+roomId+'/state',JSON.stringify({
          type:'allSongs',
          songs:localSongs.map(s=>({title:s.title,artist:s.artist,lrc:s.lrc}))
        }));
      }
      break;
    case 'countdown-0':
    case 'countdown-3':
    case 'countdown-5':
    case 'countdown-10':
      const sel=document.querySelector('#countdownSel');
      if(sel){
        const sec=data.type.split('-')[1];
        sel.value=sec;
        countdownSec=parseInt(sec);
      }
      break;
    case 'search-songs':
      const q=(data.payload.query||'').toLowerCase();
      const results=localSongs.filter(s=>
        s.title.toLowerCase().includes(q)||s.artist.toLowerCase().includes(q)
      ).slice(0,10);
      console.log('遥控器搜索:',q,'结果数:',results.length);
      if(mqttClient&&mqttClient.connected){
        mqttClient.publish('juzi/'+roomId+'/state',JSON.stringify({
          type:'searchResults',
          results:results
        }));
      }
      break;
    case 'play-song':
      // 优先按lrc路径匹配，找不到再按标题歌手匹配
      let song=null;
      if(data.payload.lrc){
        song=localSongs.find(s=>s.lrc===data.payload.lrc);
      }
      if(!song){
        song=localSongs.find(s=>
          s.title===data.payload.title&&s.artist===data.payload.artist
        );
      }
      console.log('遥控器点歌:',data.payload.title,'找到:',!!song);
      if(song){
        if(playlistPlaying){
          playlistPlaying=false;
          if(autoNextTimer){clearTimeout(autoNextTimer);autoNextTimer=null;}
          playingListBtn.style.display='none';
        }
        setLocalTrack(song).then(()=>{
          // 切歌立刻显示全屏歌名
          if(current.title&&current.title!==lastSplashTitle){
            showTitleSplash(current.title,current.artist);
          }
          // 加载完歌词后直接播放
          if(countdownSec>0&&!countdownShownOnce){
            countdownShownOnce=true;
            startCountdownThenPlay();
          }else{
            doPlay();
            resetHideTimer();
          }
        });
      }
      break;
    case 'get-playlist':
      if(currentPlaylist&&currentPlaylist.songs.length>0){
        if(mqttClient&&mqttClient.connected){
          mqttClient.publish('juzi/'+roomId+'/state',JSON.stringify({
            type:'playlistData',
            songs:currentPlaylist.songs.map(s=>({title:s.title,artist:s.artist})),
            current:currentPlaylist.songs.findIndex(s=>s.file===current.file)
          }));
        }
      }
      break;
    case 'play-playlist-song':
      if(currentPlaylist&&currentPlaylist.songs[data.payload.index]){
        playlistIndex=data.payload.index;
        playlistPlaying=true;
        const s=currentPlaylist.songs[playlistIndex];
        setLocalTrack(s).then(()=>{
          if(countdownSec>0){
            countdownShownOnce=true;
            startCountdownThenPlay();
          }else{
            doPlay();
            resetHideTimer();
          }
        });
      }
      break;
    case 'toggle-logo':
      const lt=document.querySelector('#logoToggle');
      if(lt){lt.checked=!lt.checked;lt.dispatchEvent(new Event('change'));}
      break;
    case 'set-logo-scale':
      const ls=document.querySelector('#logoScale');
      if(ls){ls.value=data.payload.value;ls.dispatchEvent(new Event('input'));}
      break;
    case 'toggle-title-splash':
      const ts=document.querySelector('#titleSplashToggle');
      if(ts){ts.checked=!ts.checked;ts.dispatchEvent(new Event('change'));}
      break;
    case 'toggle-interactive':
      const it=document.querySelector('#interactiveToggle');
      if(it){it.checked=!it.checked;it.dispatchEvent(new Event('change'));}
      break;
  }
}

// 定时同步状态到遥控器
setInterval(()=>{
  if(mqttClient&&mqttClient.connected&&isRemoteMode===false){
    const dur=getDuration();
    const progress=dur>0?(virtTime/dur)*100:0;
    function fmt(t){
      const m=Math.floor(t/60),s=Math.floor(t%60);
      return m+':'+(s<10?'0':'')+s;
    }
    mqttClient.publish('juzi/'+roomId+'/state',JSON.stringify({
      type:'timeUpdate',
      cur:fmt(virtTime),
      total:fmt(dur),
      progress:progress
    }));
  }
},1000);

// 调字号函数
function adjustFontSize(delta){
  const sel=document.querySelector('#fontSize');
  let cur=parseInt(sel.value);
  let next=cur+delta;
  if(next<20)next=20;
  if(next>120)next=120;
  sel.value=next;
  applyFontSize(next);
  // 更新显示
  const valEl=document.querySelector('#fontSizeVal');
  if(valEl)valEl.textContent=next;
  if(window.fontSizeChange)window.fontSizeChange();
}
// 恢复本地保存的设置
(function(){
  const fs=localStorage.getItem('juzi_fontSize');
  if(fs){fontSizeSel.value=fs;applyFontSize(fs);const v=document.querySelector('#fontSizeVal');if(v)v.textContent=fs;}
  const ls=localStorage.getItem('juzi_logoShow');
  if(ls!==null){document.querySelector('#logoToggle').checked=ls==='true';logoBg.classList.toggle('hide',ls!=='true');}
  const lsc=localStorage.getItem('juzi_logoScale');
  if(lsc){document.querySelector('#logoScale').value=lsc;document.documentElement.style.setProperty('--logo-scale',lsc);document.querySelector('#logoScaleVal').textContent=Number(lsc).toFixed(1);}
  const cd=localStorage.getItem('juzi_countdown');
  if(cd){countdownSec=Number(cd);document.querySelector('#countdownSel').value=cd;}
  const ts=localStorage.getItem('juzi_titleSplash');
  if(ts!==null){titleSplashEnabled=ts==='true';document.querySelector('#titleSplashToggle').checked=titleSplashEnabled;}
  const it=localStorage.getItem('juzi_interactive');
  if(it!==null){interactiveMode=it==='true';document.querySelector('#interactiveToggle').checked=interactiveMode;const legend=document.querySelector('#interactiveLegend');if(interactiveMode)legend.classList.remove('hidden');else legend.classList.add('hidden');}
})();
/* ===== 抽奖功能 ===== */
let luckyPool=[],luckyRollTimer=null,luckyPlayed=[];
const luckyOverlay=document.querySelector('#luckyOverlay');
const luckyBtn=document.querySelector('#luckyBtn');

luckyBtn.onclick=()=>{
  luckyOverlay.classList.remove('hidden');
  luckyPool=localSongs.slice();
  // 生成抽奖配对二维码
  if(window.mqttClient&&mqttClient.connected){
    const luckyUrl=location.origin+location.pathname+'?lucky='+roomId;
    document.querySelector('#luckySong').textContent='等待手机连接';
    document.querySelector('#luckyArtist').textContent='扫码开始抽奖';
    // 生成二维码
    const qr=qrcode(0,'M');
    qr.addData(luckyUrl);
    qr.make();
    const mods=qr.getModuleCount();
    const size=Math.floor(200/mods);
    let html='<div style="width:200px;height:200px;background:#fff;padding:10px;border-radius:8px;margin:30px auto;"><table style="border:0;margin:0 auto;border-collapse:collapse;">';
    for(let r=0;r<mods;r++){
      html+='<tr style="height:'+size+'px;">';
      for(let c=0;c<mods;c++){
        html+='<td style="width:'+size+'px;'+(qr.isDark(r,c)?'background:#000;':'background:#fff;')+'"></td>';
      }
      html+='</tr>';
    }
    html+='</table></div>';
    document.querySelector('#luckySong').outerHTML='<div id="luckySong">'+html+'</div>';
  }
};
document.querySelector('#luckyCloseBtn').onclick=()=>{
  luckyOverlay.classList.add('hidden');
  clearInterval(luckyRollTimer);
};

// 遥控器消息处理抽奖
function luckyStartRolling(songs){
  luckyPool=songs;
  document.querySelector('#luckyResult').classList.remove('show');
  document.querySelector('#luckySong').classList.add('rolling');
  clearInterval(luckyRollTimer);
  luckyRollTimer=setInterval(()=>{
    const s=luckyPool[Math.floor(Math.random()*luckyPool.length)];
    document.querySelector('#luckySong').textContent=s.title;
    document.querySelector('#luckyArtist').textContent=s.artist;
  },80);
}
function luckyStopRolling(){
  clearInterval(luckyRollTimer);
  let count=0;
  const finalS=luckyPool[Math.floor(Math.random()*luckyPool.length)];
  const slowDown=setInterval(()=>{
    count++;
    const s=luckyPool[Math.floor(Math.random()*luckyPool.length)];
    document.querySelector('#luckySong').textContent=s.title;
    document.querySelector('#luckyArtist').textContent=s.artist;
    if(count>=12){
      clearInterval(slowDown);
      document.querySelector('#luckySong').classList.remove('rolling');
      document.querySelector('#luckyResultSong').textContent=finalS.title;
      document.querySelector('#luckyResultArtist').textContent=finalS.artist;
      document.querySelector('#luckyResult').classList.add('show');
      // 存当前抽中的歌，等点了播放才算已唱
      window._luckyResult=finalS;
    }
  },200);
}
document.querySelector('#luckyPlayBtn').onclick=()=>{
  const s=window._luckyResult;
  if(s){
    setLocalTrack(s).then(()=>{
      luckyOverlay.classList.add('hidden');
      doPlay();
    });
  }
};
document.querySelector('#luckyAgainBtn').onclick=()=>{
  document.querySelector('#luckyResult').classList.remove('show');
  luckyStartRolling(luckyPool);
};