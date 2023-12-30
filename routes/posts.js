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
//메인 페이지 검색 기능
router.get('/search', async (req, res) => {
    try {
        // 사용자의 검색어를 정규 표현식으로 변환
        const searchQuery = new RegExp(req.query.title, 'i');

        const searchResult = await db.collection('post').find({ title: searchQuery }).toArray();
        req.session.searchResult = searchResult;
        res.redirect('/main/0?search=true');
    } catch (err) {
        console.error(err);
        res.status(500).send('서버 오류');
    }
});

//메인 페이지
router.get('/main/:id', async (req, res) => {
    try {
        const isSearchMode = req.query.search;
        let result;
        let pageId;
        let totalPages;

        if (isSearchMode && req.session.searchResult) {
            result = req.session.searchResult;
        } else {
            const pageSize = 8;
            const totalCount = await db.collection('post').countDocuments();
            totalPages = Math.ceil(totalCount / pageSize);

            pageId = parseInt(req.params.id) || 1;
            const skip = (pageId - 1) * pageSize;

            result = await db.collection('post')
                .find()
                .skip(skip)
                .limit(pageSize)
                .toArray();
        }

        res.render('main.ejs', {
            result: result,
            pageId: pageId,
            totalPages: totalPages
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('서버 오류');
    }
});


//글쓰는 페이지로 이동
router.get('/write', (req, res)=>{
    if(req.session.userId){
        res.render('write.ejs', { userId : req.session.userId});
    }else{
        res.render('login.ejs');
    }
    
})
//글쓰기 기능
router.post('/add', async (req, res)=>{
    try {
        if(req.body.userId){
            const result = await db.collection('post').insertOne({
                userId : req.session.userId,
                title: req.body.title,
                content: req.body.content
            });
            res.redirect('/main/1');
        }
        // 저장 후 리디렉션 또는 응답
    } catch (err) {
        console.error(err);
        // 에러 처리
    }
});
//상세페이지로 이동
router.get('/detail/:id', async (req, res) => {
    try {
        const postId = req.params.id;
        const post = await db.collection('post').findOne({_id: new ObjectId(postId)});
        const comments = await db.collection('comment').find({postId: postId}).toArray();
        const errorMessage = req.query.error;
        res.render('detail.ejs', {
            result: post,
            comments: comments,
            sessionUserId: req.session.userId,
            error: errorMessage
        });
    } catch (err) {
        console.log(err);
        res.status(500).send('서버 오류');
    }
});
// 글 수정 페이지로 이동
router.get('/edit/:id', async (req, res)=>{
    try{
        const result = await db.collection('post').findOne({_id : new ObjectId(req.params.id)});
        res.render('edit.ejs', {result : result});
    }catch (err){
        console.log(err);
    }
})
// 글 수정 기능
router.post('/edit/submit/:id', async (req, res)=>{
    try{
        const post = await db.collection('post').findOne({ _id : new ObjectId(req.params.id)});
        const postUserId = new ObjectId(post.userId);
        if(postUserId.equals(new ObjectId(req.session.userId))){
            const result = await db.collection('post').updateOne(
                { _id: new ObjectId(req.params.id)},
                {$set : { title : req.body.title, content : req.body.content}}
            );
        }else { 
            {
                res.status(403).send('권한이 없습니다.');
            }
        }
        res.redirect('/main/1');
    }catch (err){
        console.log(err);
    }
})
//글 삭제 기능
router.get('/delete/:id', async (req, res)=>{
    try{
        const post = await db.collection('post').findOne({ _id : new ObjectId(req.params.id)});
        const postUserId = new ObjectId(post.userId);
        if(postUserId.equals(new ObjectId(req.session.userId))){
            await db.collection('post').deleteOne({ _id : new ObjectId(req.params.id) });
            await db.collection('comment').deleteMany({ postId : req.params.id });
            res.redirect('/main/0');
        }else { 
            {
                res.status(403).send('권한이 없습니다.');
            }
        }
    }catch (err){
        console.log(err);
    }
})
//댓글 기능
router.post('/comment/:id', async (req, res) => {
    try {
        if(req.session.userId) {
            const userinfo = await db.collection('user').findOne({ _id: new ObjectId(req.session.userId) });
            const username = userinfo.username;

            await db.collection('comment').insertOne({
                postId: req.params.id,
                userId: req.session.userId,
                comment: req.body.comment,
                username: username
            });

            res.redirect(`/detail/${req.params.id}`);
        } else {
            res.redirect(`/detail/${req.params.id}?error=로그인 후 이용해 주세요`);
        }
    } catch (err) {
        console.log(err);
        res.redirect(`/detail/${req.params.id}?error=서버 오류`);
    }
});



    return router;
};



