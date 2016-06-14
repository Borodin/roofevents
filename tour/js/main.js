var version = [0, 0, 7];

var data, camera, scene, renderer, mesh;
var panoramaID = 0;
var tourLocation = '';

var fov= 70 , afov = fov,
isUserInteracting = false,
autorotation = false,
autorotation_speed = 0,
onMouseDownMouseX = 0, onMouseDownMouseY = 0,
kineticScrollLon = 0, kineticScrollLat= 0,
lon = 0, onMouseDownLon = 0,
lat = 0, onMouseDownLat = 0,
phi = 0, theta = 0,
alon = 0, alat = 0;
var materials;
var touchDistance = 0;
var tileset = [1, 3, 4, 5, 0, 2];
var markers = [];
var queries = {};
var open_tab = false
var editor = false;

var rotationAlpha = 0
var rotationBeta = 0
var rotationGamma = 0
var rendererName = '';
var imageType = '';
console.info('TourPlayer v'+version.join('.')+' by http://Tour-360.ru')

/*====== debug =======*/


/*====================*/

function getQuery(){
	var all = location.search.slice(1).replace(/&amp;/g, '&').split('&');
	for(var i=0; i<all.length; i++){
		var str = all[i].split('=');
		queries[str[0]] = str[1];
	};
	panoramaID = parseInt(queries.id) || 0;
	alon = lon = parseFloat(queries.lon) || 0;
	alat = lat = parseFloat(queries.lat) || 0;
	afov = fov = parseFloat(queries.fov) || 0;
	autorotation = (queries.autorotation === 'true');
	tourLocation = queries.name?'/projects/'+queries.name+'/data.json':'data.json';
	if(queries.data)tourLocation=queries.data;
}

function setQuery(){
	var url = (queries.name?'?name='+queries.name+'&':'?')+
	'id='+panoramaID+
	'&lon='+alon.toFixed(2)+
	'&lat='+alat.toFixed(2)+
	'&fov='+afov.toFixed(2)

	for(var key in queries)if(!(/id|lon|lat|fov/).test(key)&&key)url+='&'+key+'='+queries[key];
	history.pushState({lon:alon, lat:alat, fov:afov, id:panoramaID}, window.document.title, url);
}

function onPopState(e){
	if('keys' in Object&&Object.keys(e.state).length){
		fov = e.state.fov;
		alat = e.state.lat;
		alon = e.state.lon;
		if(panoramaID!=e.state.id)setPanorama(e.state.id);
	}
}

var onSetPanoram = false
function setPanorama (id, option, start){
	var layer = document.getElementById('layer');
	if(rendererName != 'css')layer.src =  renderer.domElement.toDataURL('image/jpeg');
	if(!start){
		layer.className = 'show';
		document.getElementById('markers').className = '';
	}
	panoramaID = id||0;
	var rid = data.panorams[id].id?parseInt(data.panorams[id].id)+1:parseInt(id)+1;
	if(!queries.name){
		if(!data.panorams[id].image)data.panorams[id].image         = 'panorams/'+(rid)+'/3000/*.jpg';
		if(!data.panorams[id].mobile)data.panorams[id].mobile       = 'panorams/'+(rid)+'/900/*.jpg';
		if(!data.panorams[id].image_min)data.panorams[id].image_min = 'panorams/'+(rid)+'/0.jpg';
	}else{ // Кастыль для старых вставок iframe
		data.panorams[id].image     = '/projects/'+queries.name+'/panorams/'+(rid)+'/3000/*.jpg';
		data.panorams[id].mobile    = '/projects/'+queries.name+'/panorams/'+(rid)+'/900/*.jpg';
		data.panorams[id].image_min = '/projects/'+queries.name+'/panorams/'+(rid)+'/0.jpg';
	}

	if(!option) option={}
	rotationBeta = alon = lon = ( option.lon || data.panorams[panoramaID].lon || 0);
	rotationAlpha = alat = lat = ( option.lat || data.panorams[panoramaID].lat || 0);
	afov = fov = option.fov || data.panorams[panoramaID].fov||70;
	rotationGamma = 0

	setTexture(id);
	setQuery();
	deleteMarkers();
	createMarkers();
	if(data.autorotation)control.autorotation(true);
	if(onSetPanoram)onSetPanoram()
}


var onLoadPano = false
var imageLoaded = 0;


function setLoader(n){
	var loader = document.getElementById('loader')
	var control_block = document.getElementById('control_block');
	if(n){
		document.getElementById('layer').className = '';
		document.getElementById('markers').className = 'show';
		imageLoaded++;
		loader.className = '';
	}else{
		control_block.classList.remove('loader_hidden');
		setWait(true);
		imageLoaded=0;
		loader.className = 'null';
	}
	if(imageLoaded==7){
		setTimeout(function(){control_block.classList.add('loader_hidden')}, 1000);
		setWait(false);
		if(onLoadPano)onLoadPano()
	}
	loader.style.width = imageLoaded/7*100+'%'; 
}

function setWait(n){
	var cont = document.getElementById('appContainer');
	cont.style.display='none';
	cont.offsetHeight; // no need to store this anywhere, the reference is enough
	cont.style.display='';
	n?cont.classList.add('wait'):cont.classList.remove('wait');
}


function setTexture(id){
	setLoader(false);
	imageLoaded=0
	if(data.projection == 'spherical'){
		var material = new THREE.MeshBasicMaterial({map: THREE.ImageUtils.loadTexture(data.panorams[id].image_min), overdraw: true});
	}else{
		var loader = new THREE.ImageLoader();
		loader.load(data.panorams[id].image_min, function(img){
			setLoader(true);
			var canvas = document.createElement("canvas"); canvas.width = img.width; canvas.height = img.height;
			var ctx = canvas.getContext("2d")
			ctx.drawImage(img, 0, 0);
			var sprites = [];
			for(var i=0; i<6; i++){
				var imgeURL = data.panorams[id][imageType].replace('*', tileset[i]);
				if(rendererName == 'css'){
					var tempcanvas = document.createElement("canvas");tempcanvas.width = img.height; tempcanvas.height = img.height;
					var tempctx = tempcanvas.getContext("2d");
					tempctx.putImageData(ctx.getImageData((tileset[i])*img.height, 0, img.height, img.height),0,0);
					scene.children[i].element.src = tempcanvas.toDataURL('image/jpeg');
					scene.children[i].element.onload = function(){setLoader(true)}
					scene.children[i].element.src = imgeURL;
				}else{
					var texture = new THREE.Texture(ctx.getImageData((tileset[i])*img.height, 0, img.height, img.height));
					texture.needsUpdate = true;
					mesh.material.materials[i].map = texture;
					
					var texloader = new THREE.TextureLoader();
					texloader.load(imgeURL, function(id){ return function(tex){
						tex.magFilter = tex.minFilter = THREE.LinearFilter;
						tex.anisotropy = renderer.getMaxAnisotropy();
						mesh.material.materials[id].map = tex;
						setLoader(true);
					}}(i))
				}
			}
		});
	}
}


function setPlane(id, name){
	if(rendererName != 'css'){
		var texloader = new THREE.TextureLoader();
		texloader.load(data.panorams[panoramaID][imageType].replace('*', name), function(id){ return function(tex){
			tex.magFilter = tex.minFilter = THREE.LinearFilter;
			mesh.material.materials[id].map = tex;
		}}(id))
	}else{
		scene.children[id].element.src = data.panorams[panoramaID][imageType].replace('*', name);
	}
}



function setRenderer(name){
	rendererName = name;
	var info = document.getElementById('info');
	var v = 'TourPlayer v'+version.join('.');

	if(name == 'webgl'){
		renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
		info.innerHTML = v+' (WebGLRenderer)'
	}else if(name == 'css'){
		renderer = new THREE.CSS3DRenderer();
		info.innerHTML = v+' (CSS3DRenderer)' 
	}else if(name == 'canvas'){
		renderer = new THREE.CanvasRenderer();
		info.innerHTML = v+' (CanvasRenderer)'
	}
	renderer.domElement.id = 'renderer'
}


function init() {
	camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 1, 1100);
	camera.target = new THREE.Vector3(0, 0, 0);
	scene = new THREE.Scene();


	var rendererType = ''
	if(jscd.array){
		if(jscd.webgl()&&!jscd.apple){
			rendererType = 'webgl'
		}else if(jscd.css()){
			rendererType = 'css'
		}else if(jscd.canvas()){
			rendererType = 'canvas'
		}
	}

	if(!queries.renderer&&!rendererType){
		location.href = document.getElementsByTagName('script')[0].src.split('/js/')[0]+'/badbrowser.html?'+location.href;
	}else setRenderer(queries.renderer||rendererType)


	imageType = queries.imagetype||(jscd.mobile||rendererType=='canvas'? 'mobile':'image');
	
	renderer.setSize( window.innerWidth, window.innerHeight);


	if(data.projection == 'spherical'){
		var cof = window.WebGLRenderingContext? 1:2;
		var geometry = new THREE.SphereGeometry(300, Math.ceil(60/cof), Math.ceil(40/cof));
			geometry.applyMatrix(new THREE.Matrix4().makeScale(-1, 1, 1));
		var material = new THREE.MeshBasicMaterial({map: THREE.ImageUtils.loadTexture(data.panorams[id].image_min), overdraw: true});
	}else{
		if(rendererName == 'css'){
			var geometry = [
				[0,0,100,0,Math.PI,0],
				[-100,0,0,0,Math.PI/2,0],
				[0,0,-100,0,0,0],
				[100,0,0,0,Math.PI*1.5,0],
				[0,100,0,-Math.PI*1.5,0,Math.PI],
				[0,-100,0,-Math.PI/2,0,Math.PI]
			];
			for ( var i = 0; i < geometry.length; i ++ ) {
				var element = document.createElement( 'img' );
				element.ondragstart = function(event) { event.preventDefault(); };
				var size = imageType=='mobile'?1024:2048;
				element.style.width = size+'px';
				element.style.height = size+'px';
				element.style.border = '0px';
				mesh = new THREE.CSS3DObject( element );
				mesh.position.x = geometry[ tileset[i] ][ 0 ];
				mesh.position.y = geometry[ tileset[i] ][ 1 ];
				mesh.position.z = geometry[ tileset[i] ][ 2 ];
				mesh.rotation.x = geometry[ tileset[i] ][ 3 ];
				mesh.rotation.y = geometry[ tileset[i] ][ 4 ];
				mesh.rotation.z = geometry[ tileset[i] ][ 5 ];
				mesh.scale.x = 2/size*100+.0001;
				mesh.scale.y = 2/size*100+.0001;
				scene.add(mesh);
			}
			renderer.domElement.width = window.innerWidth;
			renderer.domElement.height = window.innerHeight;
		}else{
			var segments = rendererName=='canvas'?8:1;
			var geometry = new THREE.CubeGeometry(-300, 300, 300, segments, segments, segments);
			materials = new THREE.MeshFaceMaterial([
				new THREE.MeshBasicMaterial({map: THREE.ImageUtils.loadTexture(''), overdraw: true }),
				new THREE.MeshBasicMaterial({map: THREE.ImageUtils.loadTexture(''), overdraw: true }),
				new THREE.MeshBasicMaterial({map: THREE.ImageUtils.loadTexture(''), overdraw: true }),
				new THREE.MeshBasicMaterial({map: THREE.ImageUtils.loadTexture(''), overdraw: true }),
				new THREE.MeshBasicMaterial({map: THREE.ImageUtils.loadTexture(''), overdraw: true }),
				new THREE.MeshBasicMaterial({map: THREE.ImageUtils.loadTexture(''), overdraw: true })
			])
			mesh = new THREE.Mesh(geometry, materials);
		}
		scene.add(mesh);
	}

	renderer.domElement.addEventListener('click', function(){window_close()}, false);


	document.getElementById('tour').insertBefore(renderer.domElement, 	document.getElementById('markers'));

	document.addEventListener('mousedown', onDocumentMouseDown, false );
	document.addEventListener('mousemove', onDocumentMouseMove, false );
	document.addEventListener('mouseup', onDocumentMouseUp, false );

	document.addEventListener('touchstart', onDocumentMouseDown, false );
	document.addEventListener('touchmove', onDocumentMouseMove, false );
	document.addEventListener('touchend', onDocumentMouseUp, false );

	document.addEventListener('mousewheel', onDocumentMouseWheel, false );
	document.addEventListener('DOMMouseScroll', onDocumentMouseWheel, false);

	window.addEventListener('popstate', onPopState, false);

	//window.addEventListener('blur', mousemenu.hide, false );
	window.addEventListener('resize', onWindowResize, false );

	window.addEventListener('keyup', onKeyUp, false)
	//window.addEventListener('error', onError, false)
	window.onerror = onError;

	//window.addEventListener('devicemotion', deviceMotionHandler, false);
	//window.addEventListener('deviceorientation', DeviceOrientationEvent, false);
	
	animate();
	onWindowResize();
	setSlider();
}

function animate() {
	requestAnimationFrame(animate);
	if(!isUserInteracting){
		lat-=kineticScrollLat; kineticScrollLat/=1.15 
		lon-=kineticScrollLon; kineticScrollLon/=1.15
		if(!kineticScrollLat)lat-=(lat-alat)/8;
		if(!kineticScrollLon)lon-=(lon-alon)/8;
	}
	if(autorotation&&imageLoaded==7){
		if(autorotation_speed<0.1)autorotation_speed+=0.0005
		alon+=autorotation_speed;
	}else{
		autorotation_speed=0
	}

	if(data.config){
		if(data.config.max_lat&&lat>data.config.max_lat)lat=alat=data.config.max_lat;
		if(data.config.min_lat&&lat<data.config.min_lat)lat=alat=data.config.min_lat;
		if(data.config.max_lon&&lon>data.config.max_lon)lon=alon=data.config.max_lon;
		if(data.config.min_lon&&lon<data.config.min_lon)lon=alon=data.config.min_lon;
	}

	lat = Math.max( data.minlat || - 85, Math.min( data.maxlat || 85, lat ) );
	phi = THREE.Math.degToRad( 90 - lat );
	theta = THREE.Math.degToRad( lon );

	camera.target.x = 300 * Math.sin( phi ) * Math.cos( theta );
	camera.target.y = 300 * Math.cos( phi );
	camera.target.z = 300 * Math.sin( phi ) * Math.sin( theta );

	afov-=(afov-fov)/8;
	camera.fov = afov;
	camera.projectionMatrix.makePerspective(afov, window.innerWidth / window.innerHeight, 1, 1100 );

	camera.lookAt( camera.target );
	render();
}


var onRender = false;

function render() {
	renderer.render( scene, camera );
	for(i=0; i<markers.length; i++) markers[i].draw();
	if(onRender)onRender()
}

function onKeyUp( event ) {
	switch (event.keyCode) {
		case 65: case 37: control.left(); break       // A ← 
		case 87: case 38: control.up(); break         // W ↑
		case 68: case 39: control.right(); break      // D →
		case 83: case 40: control.down(); break       // S ↓
		case 16: case 187: control.zoomin(); break    // + Shift
		case 17: case 189: control.zoomout(); break   // - Ctrl
		case 72: case 77:  control.hideMenu(); break  // H M
		case 113: control.editor(); break             // E F2
		case 82: control.autorotation(); break        // R
		case 27: window_close(); break                // Esc
	}
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
	camera.projectionMatrix.makePerspective(fov, window.innerWidth / window.innerHeight, 1, 1100 );
	if(document.querySelector('#window'))document.querySelector('#window').className = window.innerWidth>window.innerHeight?'':'mobile'
	if(open_tab&&document.querySelector('#window')){
		var text = document.querySelector('#window li#tab_'+open_tab+' .text');
		var img = document.querySelector('#window li#tab_'+open_tab+' img');
		var win = document.querySelector('#window');
		text.style.marginTop = window.innerWidth>window.innerHeight?-text.offsetHeight/2+'px':(((win.offsetHeight - img.offsetHeight)/2)-(text.offsetHeight/2)-20)+'px';
	}
}

function onDocumentMouseDown( event ) {
	isUserInteracting = true;
	if('touches' in event){
		event.clientX = event.touches[0].pageX;
		event.clientY = event.touches[0].pageY;
	}

	onPointerDownPointerX = event.clientX;
	onPointerDownPointerY = event.clientY;
	kineticScrollLon = onPointerDownLon = lon;
	kineticScrollLat = onPointerDownLat = lat;
	startFov = fov
}

function onDocumentMouseMove( event ) {
	event.preventDefault();
	if (isUserInteracting&&!window.stopdrag) {
		if('touches' in event){
			event.clientX = event.touches[0].pageX;
			event.clientY = event.touches[0].pageY;
			if(event.touches.length>=2){
				var distance = Math.sqrt(
					Math.pow(event.touches[0].pageY-event.touches[1].pageY,2)-
					Math.pow(event.touches[0].pageX-event.touches[1].pageX,2)
				);
				if(!touchDistance)touchDistance=distance;
				fov=startFov-(distance-touchDistance)/5;
				if(fov<20)fov=20;
				if(fov>90)fov=90;
			}
		}
		kineticScrollLon = lon;
		kineticScrollLat = lat;
		lon = ( onPointerDownPointerX - event.clientX ) * 0.1*(fov/70) + onPointerDownLon;
		lat = ( event.clientY - onPointerDownPointerY ) * 0.1*(fov/70) + onPointerDownLat;
	}
}

function onDocumentMouseUp( event ) {
	isUserInteracting = ('touches' in event && event.touches.length);
	touchDistance = false
	kineticScrollLon-=lon;
	kineticScrollLat-=lat;
	rotationAlpha=lat
	rotationBeta=lon
	rotationGamma=0;
	if(Math.abs(kineticScrollLon)<0.3||Math.abs(kineticScrollLon)>20)kineticScrollLon=0
	if(Math.abs(kineticScrollLat)<0.3||Math.abs(kineticScrollLat)>20)kineticScrollLat=0
	alon = lon; alat = lat;
	setQuery();
}


function deviceMotionHandler( event ){
	var rotation = event.rotationRate;

	rotationAlpha += rotation.alpha
	rotationBeta -= rotation.beta
	rotationGamma -= rotation.gamma

	//if(rotationAlpha>90)rotationAlpha=90
	//if(rotationAlpha<-90)rotationAlpha=-90

	if(!isUserInteracting){
		alat = lat = rotationAlpha
		alon = lon = rotationBeta+rotationGamma
	}
}

function onDocumentMouseWheel( event ) {
	event.preventDefault();
	var delta = Math.max(-1, Math.min(1, (event.wheelDelta || -event.detail)));
	delta>0?control.zoomin():control.zoomout();
}

function onError(msg, url, line, col){
	var img = new Image();
	img.src = '//tour-360.ru/test/error.php'+
	'?error_msg='+msg+
	'&error_url='+url+
	'&error_line='+line+
	'&error_col='+col+

	'&os='+jscd.os+
	'&os_v='+jscd.osVersion+
	'&browser='+jscd.browser+
	'&browser_v='+jscd.browserVersion+

	'&webgl='+jscd.webgl()+
	'&css='+jscd.css()+
	'&canvas='+jscd.canvas()+

	'&mobile='+jscd.mobile+
	'&array='+jscd.array+

	'&url='+window.location.href;
	'&resolution='+jscd.screen;
}


var tourLoader = function(url){
	var xhr = new XMLHttpRequest();
	xhr.open('GET', url, true);
	xhr.onreadystatechange = function () {
		if (xhr.readyState == 4 && xhr.status == 200){
			data = JSON.parse(xhr.responseText);
			init();
			setPanorama(!queries.id&&data.startPanorama||panoramaID, {lon:lon, lat:lat, fov:fov}, true);
		}
	};
	xhr.send();
}


var load = function(){
	getQuery()
	mousemenu.element = document.getElementById('mouse_menu');
	window.addEventListener('contextmenu', mousemenu.show);
	document.getElementById('tour').addEventListener('mousedown', function(){
		mousemenu.hide();
		autorotation = false;
	});
	tourLoader(tourLocation);
}
window.addEventListener(document.addEventListener?'DOMContentLoaded':'load', load);


var Marker = function(id){
	var pano = data.panorams[panoramaID];
	var marker = pano.markers[id];
	this.type = marker.type;
	this.object = new THREE.Object3D();



	marker.x = marker.lon||marker.x; // Кастыль
	marker.y = -marker.lat||marker.y;

	this.object.position.set(
		Math.cos(Math.PI*2 * marker.x/360)*Math.sin(Math.PI * (marker.y+90)/180)*300,
		Math.cos((marker.y+90)/180*Math.PI)*300,
		Math.sin(Math.PI*2 * marker.x/360)*Math.sin(Math.PI * (marker.y+90)/180)*300
	);
	scene.add(this.object);
	this.element = document.createElement('div');
	if(!marker.type||marker.type=='panorama'){
		//this.element.title = data.panorams[marker.link.id].title || marker.title || '';
		this.element.className = marker.className || 'marker';
		if(marker.direction)this.element.className+=' '+marker.direction;
		this.element.onclick = function(id, opt){ return function(){
			opt.norotate? setPanorama(id, {fov:fov, lat:lat, lon:lon}): setPanorama(id, opt);
		}}(marker.link.id, marker.link)
		if(marker.link.norotate && !marker.direction)this.element.className += ' info'
	}else if(marker.type=='info'){
		this.element.className = 'marker info';
		if(marker.link&&marker.link.window)this.element.onclick = function(){
				window_open(marker.link.window);
		}
		if(marker.link&&marker.link.planes)this.element.onclick = function(){
			//setWait(true);
			for(var k in marker.link.planes){
				//setTimeout(function(k, marker){return function(){
					setPlane(k, marker.link.planes[k][0]);
				//}}(k, marker), 10)
				marker.link.planes[k].push(marker.link.planes[k].shift());
			}
		}
	}
	if(marker.title|| data.panorams[marker.link.id].title){
		this.title_div = document.createElement('div');
		this.title_span = document.createElement('span');
		this.title_span.innerHTML = marker.title || data.panorams[marker.link.id].title || '';
		this.title_div.appendChild(this.title_span);
		this.element.appendChild(this.title_div);
	}
	document.getElementById('markers').appendChild(this.element);
	for(i=0; i<markers.length; i++) markers[i].draw();
}

Marker.prototype.draw = function(){
	var projector = new THREE.Projector();
	var pos = projector.projectVector(this.object.position.clone(), camera );
	if(pos.z<1){
		this.element.style.display = 'block';
		var devicePixelRatio = (rendererName == 'css')?1:window.devicePixelRatio;
		var left = ((pos.x * (renderer.domElement.width/2)) + (renderer.domElement.width/2)-this.element.offsetWidth/2)/devicePixelRatio;
		var top = (-(pos.y * (renderer.domElement.height/2)) + (renderer.domElement.height/2)-this.element.offsetHeight/2)/devicePixelRatio;
		this.element.style.left = left+'px'; this.element.style.top  = top+'px';
		if(this.title_div){
			var spanClass = 'bottom'
			if(top > renderer.domElement.height-200)spanClass = 'top';
			if(left < 200)spanClass = 'right';
			if(left > renderer.domElement.width-200)spanClass = 'left';
			this.title_div.className = spanClass;
		}
	}else{
		this.element.style.display = 'none';
	}
}

var createMarkers = function(){
	for(var i=0; i<data.panorams[panoramaID].markers.length; i++){
		var marker = new Marker(i);
		markers.push(marker);
	}
}

var deleteMarkers = function(){
	document.getElementById('markers').innerHTML = '';
	markers = [];
}



var control = {
	fullscreen: function(event){
		var btn = document.getElementById('fs');
		if(document.fullscreenElement
		 ||document.msFullscreenElement
		 ||document.webkitCurrentFullScreenElement
		 ||document.mozFullScreenElemenz
		){
			var e=document;
			if (e.exitFullscreen) e.exitFullscreen();
			else if (e.msExitFullscreen) e.msExitFullscreen();
			else if (e.webkitCancelFullScreen) e.webkitCancelFullScreen();
			else if (e.mozCancelFullScreen) e.mozCancelFullScreen();
			btn.className = 'fullscreen';
		}else{
			var e = document.documentElement;
			if (e.requestFullscreen) e.requestFullscreen();
			else if (e.msRequestFullscreen) e.msRequestFullscreen();
			else if (e.webkitRequestFullScreen) e.webkitRequestFullScreen();
			else if (e.mozRequestFullScreen) e.mozRequestFullScreen();
			btn.className = 'fullscreen-exit';
		}
	    mousemenu.hide();
	},
	visitSite: function(){
		window.open('http://tour-360.ru', "_blank");
		mousemenu.hide();
	},
	download: function(){
		mousemenu.hide();
		var link = document.createElement('a');
		link.href = renderer.domElement.toDataURL('image/jpeg');
		link.download = 'tour_image.jpg';
		link.click();
	},
	autorotation: function(f){
		autorotation = true;
		mousemenu.hide();
		if(!f){
			alat=0;
			fov = 70;
		}
	},
	reload: function(){
		location.reload();
		mousemenu.hide();
	},
	hideMenu: function(e){
		var menu = document.getElementById('control_menu');
		menu.className = menu.className?'':'hidden';
		if(e)e.innerHTML = (menu.className?'Показать':'Скрыть')+' меню управления';
		mousemenu.hide();
	},
	zoomin: function(e){
		fov -= 20;
		if(fov<20)fov=20;
		setQuery();
		mousemenu.hide();
	},
	zoomout: function(e){
		fov += 20;
		if(fov>90)fov=90;
		setQuery();
		mousemenu.hide();
	},
	up: function(){
		if(alat<90)alat+=30;
		setQuery()
	},
	down: function(){
		if(alat>-90)alat-=30;
		setQuery()
	},
	right: function(){
		alon+=22.5;
		setQuery();
	},
	left: function(){
		alon-=22.5;
		setQuery();
	},
	getCode: function(){
		mousemenu.hide();
		var code = '<iframe src="'+location.href+'" width="640" height="480" frameborder="no" scrolling="no" allowfullscreen></iframe><br><a href="http://tour-360.ru"><br><a href="http://tour-360.ru">Профессиональная съемка 3D панорам и создание виртуальных туров 360º</a>';
		if(window.clipboardData){
			window.clipboardData.setData("Text", code);
			alert('Код скопирован в буфер обмена')
		}else window.prompt("Код для вставки", code);
		mousemenu.hide();
	},
	editor: function(){
		editor = window.open("/tour/editor.html", "Editor", 'width=440,menubar=no,toolbar=no,location=no,directories=no,status=no,resizable=no,scrollbars=no')
		editor.moveTo(window.screenX + window.outerWidth, window.screenY);
		editor.resizeTo(440, window.outerHeight);
		queries.nomenu = true;
		mousemenu.hide();
	},
	suport: function(){
		var link = document.createElement('a');
		var subject = 'Отчет об ошибке'
		var body = [
			'Описание ошибки: ',
			'Что вызвало ошибку: ',
			'Ссылка на панораму: '+escape(window.location.href),
			'--',
			document.getElementById('info').innerHTML,
			jscd.os+' '+jscd.osVersion,
			jscd.browser+' '+jscd.browserVersion,
			'Screen: '+jscd.screen,
			'WebGL:'+jscd.webgl()+'; CSSTransform:'+jscd.css()+'; Canvas:'+jscd.canvas()+'; Mobile:'+jscd.mobile+'; Float32Array:'+jscd.array
		]
		link.href = 'mailto:mail@tour-360.ru'+'?subject='+subject+"&body="+body.join('%0A');
		link.target = '_blank';
		link.click();
		mousemenu.hide();
	}
}

var mousemenu = {
	show: function(event){
		if(!queries.nomenu){
			mousemenu.element.style.display = 'block';
			mousemenu.element.style.top  = event.clientY<window.innerHeight-mousemenu.element.clientHeight? event.clientY+'px' : event.clientY-mousemenu.element.clientHeight+'px';
			mousemenu.element.style.left = event.clientX<window.innerWidth -mousemenu.element.clientWidth?  event.clientX+'px' : window.innerWidth-mousemenu.element.clientWidth +'px';
			event.preventDefault();
	    	event.stopPropagation();
			return false;
		}
	},
	hide: function(event){
		mousemenu.element.style.display = 'none';
	}
}

function window_close(f){
	if(!f&&document.querySelector('#window'))document.querySelector('#window').style.display = 'none';
	var tabs = document.querySelectorAll('#window > ul > li');
	for(var i=0; i<tabs.length; i++)tabs[i].style.display = 'none';
}

function window_open(tab_name){
	open_tab = tab_name;
	window_close(true);
	document.querySelector('#window').style.display = 'block';
	document.querySelector('#window li#tab_'+tab_name).style.display = 'block';
	onWindowResize();
	// document.querySelector('#window').style.marginTop = -document.querySelector('#window').offsetHeight/2+'px'
}


var sliders;
var slider_frames = [];

function setSlider(){
	sliders = document.querySelectorAll('#window li .slider');
	if(sliders)for(var i=0; i<sliders.length; i++){

		var right_btn = document.createElement('div');
		var left_btn = document.createElement('div');
	    slider_frames[i] = 0;
	    right_btn.onclick = moveSlider(i);
	    left_btn.onclick = moveSlider(i);

	    left_btn.className = 'slider_btn left';
	    right_btn.className = 'slider_btn right';

		sliders[i].appendChild(left_btn);
		sliders[i].appendChild(right_btn);
		setSliderFrame(i)
	}
}

function moveSlider(i){return function(){
	this.classList.add('active'); t = this;
	setTimeout(function(t){ return function(){
		t.classList.remove('active');
	}}(t),500);

    if(this.classList.contains('right')){
        if(slider_frames[i]<sliders[i].getElementsByTagName('img').length-1)slider_frames[i]++
    }else{
        if(slider_frames[i]>=1)slider_frames[i]--;
    }

    setSliderFrame(i)

    sliders[i].getElementsByClassName('tape')[0].style.marginLeft = -100*slider_frames[i]+'%';
    sliders[i].getElementsByTagName('img').length;
}}

function setSliderFrame(i){
	var frames = sliders[i].parentElement.querySelectorAll('.frame');
    if(frames.length){
    	for(var n=0; n<frames.length; n++){
    		frames[n].classList.remove('show');
    	}
    	frames[slider_frames[i]].classList.add('show');
    }
}

//===============================
//=======[ Brouser info ]========
//===============================

function isSupportedTransform() {
  var element = document.createElement('p');
  var propertys = {
        'webkitTransformStyle':'-webkit-transform-style',
        'MozTransformStyle':'-moz-transform-style',
        'msTransformStyle':'-ms-transform-style',
        'transformStyle':'transform-style'
      };

    document.body.insertBefore(element, null);

    for (var i in propertys) {
        if (element.style[i] !== undefined) {
            element.style[i] = "preserve-3d";
        }
    }

    var st = window.getComputedStyle(element, null),
        transform = st.getPropertyValue("-webkit-transform-style") ||
                    st.getPropertyValue("-moz-transform-style") ||
                    st.getPropertyValue("-ms-transform-style") ||
                    st.getPropertyValue("transform-style");
	document.body.removeChild(element);
	return transform=='preserve-3d'
}

function isSupportedTransformWebGL() { 
	try{
		var canvas = document.createElement( 'canvas' ); 
	return !! window.WebGLRenderingContext && !!( 
		canvas.getContext( 'webgl' ) || canvas.getContext( 'experimental-webgl' ) );
	}catch( e ) { return false; } 
};

function isSupportedCanvas(){
	var elem = document.createElement('canvas');
	return !!(elem.getContext && elem.getContext('2d'));
}

(function (window) {
    {
        var unknown = '-';

        // screen
        var screenSize = '';
        if (screen.width) {
            width = (screen.width) ? screen.width : '';
            height = (screen.height) ? screen.height : '';
            screenSize += '' + width + " x " + height;
        }

        //browser
        var nVer = navigator.appVersion;
        var nAgt = navigator.userAgent;
        var browser = navigator.appName;
        var version = '' + parseFloat(navigator.appVersion);
        var majorVersion = parseInt(navigator.appVersion, 10);
        var nameOffset, verOffset, ix;

        // Opera
        if ((verOffset = nAgt.indexOf('Opera')) != -1) {
            browser = 'Opera';
            version = nAgt.substring(verOffset + 6);
            if ((verOffset = nAgt.indexOf('Version')) != -1) {
                version = nAgt.substring(verOffset + 8);
            }
        }
        // MSIE
        else if ((verOffset = nAgt.indexOf('MSIE')) != -1) {
            browser = 'Microsoft Internet Explorer';
            version = nAgt.substring(verOffset + 5);
        }
        // Chrome
        else if ((verOffset = nAgt.indexOf('Chrome')) != -1) {
            browser = 'Chrome';
            version = nAgt.substring(verOffset + 7);
        }
        // Safari
        else if ((verOffset = nAgt.indexOf('Safari')) != -1) {
            browser = 'Safari';
            version = nAgt.substring(verOffset + 7);
            if ((verOffset = nAgt.indexOf('Version')) != -1) {
                version = nAgt.substring(verOffset + 8);
            }
        }
        // Firefox
        else if ((verOffset = nAgt.indexOf('Firefox')) != -1) {
            browser = 'Firefox';
            version = nAgt.substring(verOffset + 8);
        }
        // MSIE 11+
        else if (nAgt.indexOf('Trident/') != -1) {
            browser = 'Microsoft Internet Explorer';
            version = nAgt.substring(nAgt.indexOf('rv:') + 3);
        }
        // Other browsers
        else if ((nameOffset = nAgt.lastIndexOf(' ') + 1) < (verOffset = nAgt.lastIndexOf('/'))) {
            browser = nAgt.substring(nameOffset, verOffset);
            version = nAgt.substring(verOffset + 1);
            if (browser.toLowerCase() == browser.toUpperCase()) {
                browser = navigator.appName;
            }
        }
        // trim the version string
        if ((ix = version.indexOf(';')) != -1) version = version.substring(0, ix);
        if ((ix = version.indexOf(' ')) != -1) version = version.substring(0, ix);
        if ((ix = version.indexOf(')')) != -1) version = version.substring(0, ix);

        majorVersion = parseInt('' + version, 10);
        if (isNaN(majorVersion)) {
            version = '' + parseFloat(navigator.appVersion);
            majorVersion = parseInt(navigator.appVersion, 10);
        }

        // mobile version
        var mobile = /Mobile|mini|Fennec|Android|iP(ad|od|hone)/.test(nVer);

        // system
        var os = unknown;
        var clientStrings = [
            {s:'Windows 3.11', r:/Win16/},
            {s:'Windows 95', r:/(Windows 95|Win95|Windows_95)/},
            {s:'Windows ME', r:/(Win 9x 4.90|Windows ME)/},
            {s:'Windows 98', r:/(Windows 98|Win98)/},
            {s:'Windows CE', r:/Windows CE/},
            {s:'Windows 2000', r:/(Windows NT 5.0|Windows 2000)/},
            {s:'Windows XP', r:/(Windows NT 5.1|Windows XP)/},
            {s:'Windows Server 2003', r:/Windows NT 5.2/},
            {s:'Windows Vista', r:/Windows NT 6.0/},
            {s:'Windows 7', r:/(Windows 7|Windows NT 6.1)/},
            {s:'Windows 8.1', r:/(Windows 8.1|Windows NT 6.3)/},
            {s:'Windows 8', r:/(Windows 8|Windows NT 6.2)/},
            {s:'Windows NT 4.0', r:/(Windows NT 4.0|WinNT4.0|WinNT|Windows NT)/},
            {s:'Windows ME', r:/Windows ME/},
            {s:'Android', r:/Android/},
            {s:'Open BSD', r:/OpenBSD/},
            {s:'Sun OS', r:/SunOS/},
            {s:'Linux', r:/(Linux|X11)/},
            {s:'iOS', r:/(iPhone|iPad|iPod)/},
            {s:'Mac OS X', r:/Mac OS X/},
            {s:'Mac OS', r:/(MacPPC|MacIntel|Mac_PowerPC|Macintosh)/},
            {s:'QNX', r:/QNX/},
            {s:'UNIX', r:/UNIX/},
            {s:'BeOS', r:/BeOS/},
            {s:'OS/2', r:/OS\/2/},
            {s:'Search Bot', r:/(nuhk|Googlebot|Yammybot|Openbot|Slurp|MSNBot|Ask Jeeves\/Teoma|ia_archiver)/}
        ];
        for (var id in clientStrings) {
            var cs = clientStrings[id];
            if (cs.r.test(nAgt)) {
                os = cs.s;
                break;
            }
        }

        var osVersion = unknown;

        if (/Windows/.test(os)) {
            osVersion = /Windows (.*)/.exec(os)[1];
            os = 'Windows';
        }

        switch (os) {
            case 'Mac OS X': osVersion = /Mac OS X (10[\.\_\d]+)/.exec(nAgt)[1]; break;
            case 'Android': osVersion = /Android ([\.\_\d]+)/.exec(nAgt)[1]; break;
            case 'iOS': osVersion = /OS (\d+)_(\d+)_?(\d+)?/.exec(nVer);
				 osVersion = osVersion[1] + '.' + osVersion[2] + '.' + (osVersion[3] | 0);break;
        }
    }

    window.jscd = {
        browser: browser,
        browserVersion: version,
        mobile: mobile,
        os: os,
        osVersion: osVersion,
        css: isSupportedTransform,
        webgl: isSupportedTransformWebGL,
        canvas: isSupportedCanvas,
        screen: screenSize,
        array: !!window.Float32Array,
        apple: !!~['iOS','Mac OS X','iOS'].indexOf(os)
    };
}(this));
