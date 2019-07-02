import User from "../../Model/User"
import Article from "../../Model/Article"
import ArticleContainer from "../../Model/ArticleContainer"
import Comment from "../../Model/Comment"
import Profile from "../../Model/Profile"
import UserForm from "../../Model/UserForm"

export default interface ConduitRepository {

    // Users
    login: (email: string, password: string ) => Promise<User>
    // register: (form: UserForm ) => Promise<User>
    // getUser: (token: string ) => Promise<User>
    // // <<要調査>>// putUser: (token: ) => Promise<User>

    // // Articles
    getArticles: () => Promise<ArticleContainer>
    // postArticle: ( token: String, article: Article ) => Promise<boolean>
    // getArticlesForUser: ( username: string ) => Promise<Article[]>
    // getArticlesForFavoriteUser: ( username: string ) => Promise<Article[]>
    // getArticlesOfTagged: (tag: string ) => Promise<Article[]>
    // getArticlesByFollowingUser: ( token: String ) => Promise<Article[]>

    // getArticle: (slug: string) => Promise<Article>
    // putArticle: (slug: string) => Promise<boolean>
    // deleteArticle: (slug: string) => Promise<boolean>

    // favorite: ( slug: string ) => Promise<boolean>
    // unfavorite: ( slug: string ) => Promise<boolean>

    // getComments: ( slug: string ) => Promise<Comment[]>
    // postComment: ( token: string, message: string ) => Promise<boolean>
    // deleteComment: ( token: string ) => Promise<boolean>

    // // Profiles
    // getProfile: ( token: string, message: string ) => Promise<Profile>
    // follow: ( token: string, username: string ) => Promise<boolean>
    // unfollow: ( token: string, username: string ) => Promise<boolean>

    // // Tags
    getTags: () => Promise<string[]>
}

