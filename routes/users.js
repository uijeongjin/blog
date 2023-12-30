//dotenv 설정
require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();

// bodyparser 설정  
app.use(express.urlencoded({ extended: true })); // 폼 데이터 처리
app.use(express.json()); // JSON 데이터 처리


app.use(session({
    secret: process.env.SESSION_SECRET, // 세션 암호화 키
    resave: false, // 세션 데이터가 변경되지 않았을 때도 세션 저장소에 다시 저장할지 여부
    saveUninitialized: true, // 세션이 초기화되지 않은 상태로 저장할지 여부
    cookie: {
      secure: false, // HTTPS를 사용할 경우 true로 설정
      maxAge: 1000 * 60 * 60 // 쿠키 유효 시간 (예: 1시간)
    }
  }));

// 세션 확인 로직 미들웨어
app.use((req, res, next) => {
    res.locals.userId = req.session.userId;
    next();
});

// ejs 설정
app.set('view engine', 'ejs');
// 정적 파일 제공을 위한 내장 미들웨어 설정
app.use(express.static('public'));
const router = express.Router();


module.exports = function(db) {
    //회원가입 페이지로 이동
router.get('/moveSignup', async (req, res) =>{
    res.render('signup.ejs', { error : ''});
})
//회원가입 기능
router.post('/signup', async (req, res) => {
    try {
        // 정규식과 길이 제한 설정
        const MIN_LENGTH = 1;
        const MAX_LENGTH = 8;
        
        const idRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]+$/; // 문자와 숫자 조합
        const passwordRegex = /^(?=.*[!@#$%^&*])/; // 특수 기호 포함

        const { username, password } = req.body;

        // 모든 조건 검사
        if (username.length < MIN_LENGTH || username.length > MAX_LENGTH || !idRegex.test(username)) {
            res.render('signup.ejs', { error: '아이디는 1~8글자의 문자와 숫자 조합이어야 합니다.' });
        } else if (password.length < MIN_LENGTH || password.length > MAX_LENGTH || !passwordRegex.test(password)) {
            res.render('signup.ejs', { error: '비밀번호는 1~8글자이며, 특수 기호를 포함해야 합니다.' });
        } else {
            const hashPassword = await bcrypt.hash(password, 10);
            await db.collection('user').insertOne({ username, password: hashPassword });
            res.redirect('/main/0');
        }
    } catch (err) {
        console.log(err);
        res.status(500).send('서버 오류');
    }
});
//로그인 페이지로 이동
router.get('/moveLogin', async (req,res)=>{
    res.render('login.ejs');
})
//로그인 기능
router.post('/login', async(req,res)=>{
    try{
        const inputPassword = req.body.password
        const hashPassword = await db.collection('user')
        .findOne({username : req.body.username})
        bcrypt.compare(inputPassword, hashPassword.password , (err, isMatch)=>{
            if(err){
                console.log('로그인 과정중 에러발생')
            }else {
                if (isMatch){
                    console.log('비번 일치함')
                    req.session.userId = hashPassword._id;
                    res.redirect('/main/0')
                } else {
                    console.log('비번 불일치함')
                }
            }
        } )
    }catch (err){
        console.log(err);
        res.status(500).send('서버오류')
    }
})
//로그아웃 기능
router.get('/logout', async(req,res)=>{
    try{
        if(req.session.userId){
            req.session.destroy((err) =>{
                if(err) {
                    console.error('세션 파괴 오류', err);
                    return res.status(500).send('로그아웃중 오류 발생')
                }
                res.redirect('/moveLogin');
            })    
        }else {
            res.redirect('/moveLogin');
        }
    }catch (err){
        console.log(err);
    }
    
})
    return router;
};




