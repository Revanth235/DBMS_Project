const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();
const router = express.Router();
const bodyParser = require('body-parser');
const Crypto = require('crypto');
const fs = require('fs');
const fileUpload = require('express-fileupload');

var USERNAME;
var ID;
var CLASSID;
var ASSNLIST;
var ASSNPATH;

app.set('view-engine', 'ejs');
router.use(express.static('public'));

router.use(fileUpload());
app.use(express.static(__dirname+'/css'));
app.use(express.static(__dirname+'/images'));

app.use(session({
	secret:'secret',
	resave:true,
	saveUninitialized:true,
}));

app.use('/', router);
app.use('/css', express.static(__dirname+'/'));
router.use(bodyParser.urlencoded({extended : true}));
router.use(bodyParser.json());

router.get('/', function(request, response) {
	response.render('landing.ejs', {visible: false});
});

app.listen(3000);

var mysql = require('mysql');
const { time } = require('console');
const { FileArray } = require('express-fileupload');

var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "smartschool",
});

con.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");
});

function createClassCode(classCode){
	con.query('SELECT id FROM class WHERE class_id = ?', [classCode], (err, res, fields)=>{
		if (res.length > 0){
			classCode = Crypto.randomBytes(6).toString('base64').slice(0, 6);
			createClassCode(classCode);
		}
		else{
			return;
		}
	});
}

router.post('/auth', (req, response) => {
	var email = req.body.email;
	var password = req.body.password;	
	con.query("SELECT * FROM login WHERE email=? AND password=?;", [email, password], (err, res, fields)=>{
		if (res.length > 0){
			USERNAME = res[0].username;
			ID = res[0].id;
			response.redirect('/home');
		}
		else{
			response.render('login.ejs', {visible: true});
		}
	});
});

router.post('/signup', (req, response) => {
	var username = req.body.name;
	var email = req.body.email;
	var password = req.body.pass;
	con.query("INSERT INTO `login` (`email`, `password`, `username`) VALUES (?, ?, ?);", [email, password, username], (err, res, fields)=>{
		if (err){
			response.render('signup.ejs', {visible: true});
		}
		else{
			response.render('login.ejs', {visible:false});
		}
	});
});

router.get('/home', (req, response) => {
	var classList;
	var createdClassList;
	con.query("SELECT * FROM class c WHERE c.class_id in (SELECT class_id from belongs_to b WHERE b.stud_id = ?);", [ID], (err, resp, fields) => {
		if (resp.length>0){
			classList = resp.slice();
		}		
	});
	con.query("SELECT * FROM class WHERE teacher_id = ?;", [ID], (err, res, fields)=>{
		if (res.length>0){
			createdClassList = res.slice();					
	    }
		response.render('homepage.ejs', {USERNAME: USERNAME, cardsList: classList, createdCardsList: createdClassList});
	});
});

router.get('/join', (req, res)=>{
	res.render('join.ejs', {teacherofclass: false, nosuchclass: false, USERNAME: USERNAME});
});

router.get('/create', (req, res)=>{
	res.render('create.ejs', {USERNAME: USERNAME});
});

router.post('/finishcreate', (req, response)=>{
	var classCode = Crypto.randomBytes(6).toString('base64').slice(0, 6);
	createClassCode(classCode);
	var cards = ['card1', 'card2', 'card3', 'card4', 'card5'];
	var card = cards[Math.floor(Math.random()*cards.length)];
	var classname = req.body.classname;
	var roomname = req.body.room;

	con.query('INSERT INTO `class` (`class_id`, `class_name`, `room_name`, `teacher_id`, `theme`) VALUES (?, ?, ?, ?, ?)', [classCode, classname, roomname, ID, card], (err, res, fields)=>{
		if (err){
			throw err;
		}
		else{
			con.query('INSERT INTO number_classes (`class_id`, `num`) VALUES(?, ?);', [classCode, 0], (error, result, fields)=>{
				if (error){
					throw error;
				}
				else{						
					var classPath = __dirname+'/public/'+classCode;
					if (!fs.existsSync(classPath)){
						fs.mkdirSync(classPath);
					}
					var notesPath = classPath+'/notes';
					if (!fs.existsSync(notesPath)){
						fs.mkdirSync(notesPath);
					}
					var assignmentsPath = classPath+'/assignments';
					if (!fs.existsSync(assignmentsPath)){
						fs.mkdirSync(assignmentsPath);
					}
					response.redirect('/home');
				}
			});
		}
	});		
});

router.post('/finishjoin', (req, response)=>{
	var classCode = req.body.join_class;
	con.query('SELECT teacher_id FROM class WHERE class_id=?;', [classCode], (err, res, fields)=>{
		if (!res.length>0){
			response.render('join.ejs', {nosuchclass: true, teacherofclass: false, USERNAME: USERNAME});
			return;	
		}
		else{
			var teacher_id = res[0].teacher_id;
			if (!(teacher_id === ID)){
				con.query('INSERT INTO belongs_to (`class_id`, `stud_id`) VALUES (?, ?);', [classCode, ID], (err, res, fields)=>{
					if (err){
						throw err;
					}
					else{
						console.log('Added class');
						response.redirect('/home');
					}
				});
			}
			else{
				response.render('join.ejs', {teacherofclass: true, nosuchclass: false, USERNAME: USERNAME});
			}
		}
	});
});

router.get('/login', function(request, response) {
	response.render('login.ejs', {visible: false});
});

router.get('/signup', function(request, response) {
	response.render('signup.ejs', {visible: false});
});

router.get('/s/:id', (req, response)=>{
	ASSNPATH = '/s/'+req.params.id+'/get';
	console.log('req received');	
	var colors = ['#b9bffe', '#78d7ff', '#cbe894', '#90c7f2', '#feb146'];
	var theme = colors[Math.floor(Math.random()*colors.length)];
	var id = req.params.id;
	con.query('SELECT class_id FROM class WHERE id = ?', [req.params.id], (error, result, fields)=>{
		if (result.length > 0){
			CLASSID = result[0].class_id;					
			con.query('SELECT * FROM assignment WHERE class_id = (SELECT class_id FROM class WHERE id = ?);', [id], (err, res, fields)=>{
				if (res.length > 0){
					ASSNLIST = res;			
					response.render('class.ejs', {USERNAME: USERNAME, isTeacher:false, assnList: ASSNLIST, theme:theme, assn_path: ASSNPATH});
				}
				else{
					response.render('class.ejs', {USERNAME: USERNAME, isTeacher:false, assnList: res, theme:theme, assn_path: ASSNPATH});	
				}		
			});	
		}
		else{
			response.redirect('back');
		}
	});
});

router.get('/s/:class_id/:assn_id', (req, response)=>{
	var assn_id = req.params.assn_id;
	con.query('SELECT * FROM assignment WHERE id = ?;', [assn_id], (err, res, fields)=>{
		if (res.length > 0){
			var relpath = '/'+res[0].class_id+'/assignments'+'/'+res[0].assn_name+'/question/';
			var abspath = __dirname+'/public/'+relpath;
			var files = fs.readdirSync(abspath);
			var filepaths = [];
			var filenames = [];
			for (var i=0; i<files.length; i++){
				filenames[i] = files[i];
				filepaths[i] = relpath+files[i];
			}
			con.query('SELECT id FROM assignment_submit where stud_id = ? and assn_id = ?;', [ID, assn_id], (err, resp, fields)=>{
				if (resp.length > 0){					
					response.render('assign_stud.ejs', {filepaths: filepaths, filenames: filenames, assn: res[0], submitted: true});
				}
				else{
					response.render('assign_stud.ejs', {filepaths: filepaths, filenames: filenames, assn: res[0], submitted: false});
				}
			});
		}
	});
});

router.get('/r/:class_id', (req, response)=>{
	ASSNPATH = '/r/'+req.params.class_id;
	CLASSID = req.params.class_id;
	var colors = ['#b9bffe', '#78d7ff', '#cbe894', '#90c7f2', '#feb146'];
	var theme = colors[Math.floor(Math.random()*colors.length)];
	con.query('SELECT * FROM assignment WHERE class_id = ?;', [CLASSID], (err, res, fields)=>{
		if (res.length > 0){
			ASSNLIST = res;			
			response.render('class.ejs', {USERNAME: USERNAME, isTeacher:true, assnList: ASSNLIST, theme:theme, assn_path: ASSNPATH});
		}
		else{
			response.render('class.ejs', {USERNAME: USERNAME, isTeacher:true, assnList: res, theme:theme, assn_path: ASSNPATH});
		}		
	});
});

router.get('/logout', (req, res)=>{
	USERNAME="";
	ID="";
	res.redirect('/');
});

router.get('/create_assign', (req, response)=>{
	response.render('create_assign.ejs', {invalid: false});
});

router.post('/create_assign_end', (req, response)=>{
	var startTime = new Date();
	var curTime = new Date(startTime.getTime() - startTime.getTimezoneOffset()*60*1000);
	var endTime = new Date(curTime.getTime() + req.body.date*60*60*1000);
	//console.log(startTime.getTimezoneOffset());
	//console.log(curTime.toISOString().slice(0, 19).replace('T', ''));
	//console.log(endTime.toISOString().slice(0, 19).replace('T', ''));
	con.query('SELECT id FROM assignment WHERE assn_name = ?', [req.body.name], (err, res, fields)=>{
		if (res.length > 0){
			response.render('create_assign.ejs', {invalid: true});
		}
		else{
			con.query('INSERT INTO assignment (`class_id`, `assn_name`, `description`, `assn_date`, `assn_deadline`) VALUES (?, ?, ?, ?, ?)', [CLASSID, req.body.name, req.body.desc, curTime.getTime(), endTime.getTime()], (err, res, fields)=>{
				if (err){
					throw err;
				}
				else{
					var uploadpath = __dirname+'/public/'+CLASSID+'/assignments'+'/';
					uploadpath += req.body.name;
					if (!fs.existsSync(uploadpath)){
						fs.mkdirSync(uploadpath);
					}
					if (!fs.existsSync(uploadpath+'/question')){
						fs.mkdirSync(uploadpath+'/question');
					}
					if (!fs.existsSync(uploadpath+'/submissions')){
						fs.mkdirSync(uploadpath+'/submissions');
					}
					var files = req.files.addfiles;
					if (files.length === undefined){
						files.mv(uploadpath+'/question/'+files.name, (err)=>{
							if (err){
								throw err;
							}
						});					
					}
					else{
						for (var i=0; i < files.length; i++){
							files[i].mv(uploadpath+'/question/'+files[i].name, (err)=>{
								if (err){
									throw err;
								}
							});	
						}
					}
					response.redirect('/r/'+CLASSID);
				}
			});
		}
	});
});

router.get('/a/:class_id/:assn_id', (req, response)=>{
	var assn_id = req.params.assn_id;
	con.query('SELECT * FROM assignment WHERE id = ?;', [assn_id], (err, res, fields)=>{
		if (res.length > 0){
			var relpath = '/'+res[0].class_id+'/assignments'+'/'+res[0].assn_name+'/question/';
			var abspath = __dirname+'/public/'+relpath;
			var files = fs.readdirSync(abspath);
			var filepaths = [];
			var filenames = [];
			for (var i=0; i<files.length; i++){
				filenames[i] = files[i];
				filepaths[i] = relpath+files[i];
			}
			response.render('assignment.ejs', {filepaths: filepaths, filenames: filenames, assn: res[0]});
		}
	});
});

router.get('/a/:class_id/:assn_id/get_studresp', (req, response)=>{
	var assn_id = req.params.assn_id;
	con.query('SELECT * FROM assignment WHERE id = ?;', [assn_id], (err, res, fields)=>{
		if (res.length > 0){
			var relpath = '/'+res[0].class_id+'/assignments'+'/'+res[0].assn_name+'/submissions/';
			var abspath = __dirname+'/public/'+relpath;
			var files = fs.readdirSync(abspath);
			var filepaths = [];
			var filenames = [];
			for (var i=0; i<files.length; i++){
				filenames[i] = files[i];
				filepaths[i] = relpath+files[i];
				console.log(filepaths[i]);
			}
			response.render('get_res.ejs', {filepaths: filepaths, filenames: filenames});
		}
	});
});

router.post('/s/:class_id/:assn_id/:assn_name/:deadline/assign_submit', (req, response)=>{
	con.query('INSERT INTO assignment_submit (`assn_id`, `stud_id`) VALUES(?, ?)', [req.params.assn_id, ID], (err, res, fields)=>{
		if (err){
			response.redirect('back');
		}
		else{			
			console.log(new Date(new Date().getTime() - new Date().getTimezoneOffset()*60*1000).getTime());
			var files = req.files.addfiles;
			var filename;
			var path = __dirname+'/public/'+req.params.class_id+'/assignments/'+req.params.assn_name+'/submissions/';
			if (new Date(new Date().getTime() - new Date().getTimezoneOffset()*60*1000).getTime() > req.params.deadline){
				filename = '[late] '+files.name;
			}
			else{
				filename = files.name;	
			}
			files.mv(path+filename, (err)=>{
				if (err){
					throw err;
				}
			});
			response.redirect('back');	
		}
	});
});

router.get('/s/:id/get/notes', (req, response)=>{
	con.query('SELECT * FROM links WHERE `class_id` = ?;', [CLASSID], (err, res, fields)=>{
		
		var path = __dirname+'/public/'+CLASSID+'/notes/';
		var files = fs.readdirSync(path);
		var filepaths = [];
		var filenames = [];
		for (var i=0; i<files.length; i++){
			filenames[i] = files[i];
			filepaths[i] = '/'+CLASSID+'/notes/'+files[i];
		}
		response.render('notes.ejs', {isTeacher: false, links: res, filenames: filenames, filepaths: filepaths});
	});
});

router.get('/s/:id/get/attendance', (req, response)=>{
	console.log(CLASSID);
	con.query('SELECT num FROM number_classes WHERE class_id = ?', [CLASSID], (err, res, fields)=>{
		var total = parseInt(res[0].num);
		if (total < 1){
			response.render('attendance.ejs', {list: null, url: req.url, percentage: 'N/A', isTeacher: false});
		}
		else{
			con.query('SELECT count(stud_id) as count FROM attendance WHERE class_id = ? and stud_id = ?', [CLASSID, ID], (error, result, fields)=>{
				var percentage = ((parseInt(result[0].count)/total)*100).toFixed(2);
				response.render('attendance.ejs', {list: null, url: req.url, percentage: percentage, isTeacher: false});
			});
		}
	});
});

router.get('/r/:class_id/notes', (req, response)=>{
	con.query('SELECT * FROM links WHERE `class_id` = ?;', [req.params.class_id], (err, res, fields)=>{
		
		var path = __dirname+'/public/'+req.params.class_id+'/notes/';
		var files = fs.readdirSync(path);
		var filepaths = [];
		var filenames = [];
		for (var i=0; i<files.length; i++){
			filenames[i] = files[i];
			filepaths[i] = '/'+req.params.class_id+'/notes/'+files[i];
		}
		response.render('notes.ejs', {isTeacher: true, links: res, filenames: filenames, filepaths: filepaths});
	});
});

router.get('/r/:class_id/attendance', (req, response)=>{
	con.query('SELECT * FROM login WHERE id in (SELECT stud_id FROM belongs_to WHERE class_id = ?);', [req.params.class_id], (err, res, fields)=>{
		var studList = [];
		if (res.length > 0){
			studList = res;
		}		
		response.render('attendance.ejs', {list: studList, url: req.url, percentage: null, isTeacher: true});
	});
});

router.get('/r/:class_id/addnotes', (req, response)=>{
	response.render('addnotes.ejs', {url: req.url, notesadded: false, linkadded: false});
});

router.post('/r/:class_id/addnotes/upload_notes', (req, response)=>{
	var files = req.files.addfiles;
	var path = __dirname+'/public/'+req.params.class_id+'/notes/';
	if (files.length === undefined){
		files.mv(path+files.name, (err)=>{
			if (err){
				throw err;
			}
		});
	}
	else{
		for (var i=0; i<files.length; i++){
			files[i].mv(path+files[i].name, (err)=>{
				if (err){
					throw err;
				}
			});			
		}
	}
	console.log('done!');
	var url = '/r/'+req.params.class_id+'/addnotes';
	response.render('addnotes.ejs', {url: url, notesadded: true, linkadded: false});
});

router.post('/r/:class_id/addnotes/upload_link', (req, response)=>{
	var link = req.body.link;
	var name = req.body.name;
	con.query('INSERT INTO links (`class_id`, `link`, `name`) VALUES(?, ?, ?);', [req.params.class_id, link, name], (err, res, fields)=>{
		if (err){
			throw err;
		}
		else{
			response.render('addnotes.ejs', {url: req.url, notesadded: false, linkadded: true});
		}
	});	
});

router.post('/r/:class_id/attendance/submit', (req, response)=>{
	con.query('UPDATE number_classes SET num = num + 1 WHERE class_id = ?', [req.params.class_id], (err, res, fields)=>{
		if (err){
			throw err;
		}
		else{
			values = [];
			if (req.body.check == undefined){
				response.redirect('../');
				return;
			}
			if (!Array.isArray(req.body.check)){
				values[0] = {class_id: req.params.class_id, stud_id: req.body.check, atten_date: new Date(new Date().getTime())};
			}
			else{
				for (var i=0; i<req.body.check.length; i++){
					values[i] = {class_id: req.params.class_id, stud_id: req.body.check[i], atten_date: new Date(new Date().getTime())};
				}
			}					
			con.query('INSERT INTO attendance (`class_id`, `stud_id`, `atten_date`) VALUES ?;', [values.map(value=>[value.class_id, value.stud_id, value.atten_date])], (error, result, fields)=>{
				if (error){
					throw error;
				}
				else{
					response.redirect('../');
				}
			});
		}
	});
});
