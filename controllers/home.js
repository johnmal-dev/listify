module.exports = {
    getIndex: (req,res)=>{
        if (req.user){                  // added these two lines to check if a user is already logged in on home page, and if so, auto redirect to /todos
            return res.redirect('/todos')
        }
        res.render('index.ejs')
    }
}