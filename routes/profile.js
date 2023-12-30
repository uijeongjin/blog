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
   // 프로필 페이지로 이동
router.get('/profile', async(req,res)=>{
    try{
        if(req.session.userId){
            const loginUser = await db.collection('user')
            .findOne({_id : new ObjectId(req.session.userId)})
            res.render('profile.ejs',{user : loginUser});
        }else{
            res.render('login.ejs');
        }
        
    } catch (err){
        console.log(err);
        res.status(500).send('서버오류')
    }
    
})

//내가 작성한 게시글
router.get('/posts/:id', async(req,res)=>{
    try{
        const pageSize = 8; 
        const totalCount = await db.collection('post').countDocuments();
        const totalPages = Math.ceil(totalCount / pageSize);
        
        const pageId = parseInt(req.params.id) || 1;
        const skip = (pageId - 1) * pageSize;
        const result = await db.collection('post')
        .find({userId : req.session.userId})
        .skip(skip)
        .limit(pageSize)
        .toArray();

        res.render('writeList.ejs', {
            result: result,
            pageId: pageId,
            totalPages: totalPages
        })
    }catch{

    }
})
// 회원 정보 수정 페이지로 이동
router.get('/profile/info/edit', async(req, res)=>{
    try{
        res.render('profileEdit.ejs')
    }catch (err){
        console.log(err);
    }
})

//회원 정보 수정 기능
router.post('/profileEdit', async (req,res)=>{
    try{
        if(req.session.userId){
            const updateData = {

            };

            if(req.body.username) updateData.username = req.body.username;
            if(req.body.password) updateData.password = await bcrypt.hash(req.body.password, 10);
            if(req.body.address) updateData.address = req.body.address;
            if(req.body.phonNum) updateData.phonNum = req.body.phonNum;

            await db.collection('user').updateOne(
                { _id : new ObjectId(req.session.userId)},
                { $set : updateData}
                );
            res.redirect('/profile');

        };
        
    }catch (err){
        console.log(err);
    };
})
    return router;
};
