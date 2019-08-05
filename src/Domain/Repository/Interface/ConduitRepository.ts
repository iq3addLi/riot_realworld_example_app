import User from "../../Model/User"
import Article from "../../Model/Article"
import PostArticle from "../../Model/PostArticle"
import ArticleContainer from "../../Model/ArticleContainer"
import Comment from "../../Model/Comment"
import Profile from "../../Model/Profile"
import PostUser from "../../Model/PostUser"

export default interface ConduitRepository {

    // Users
    login: (email: string, password: string ) => Promise<User>
    register: (username: string, email: string, password: string ) => Promise<User>

    // GET {{APIURL}}/user
    getUser: (token: string ) => Promise<User>

    // PUT {{APIURL}}/user
    updateUser: (token: string, user: PostUser) => Promise<User>

    // Articles
    getArticles: ( token?: string, limit?: number, offset?: number) => Promise<ArticleContainer>
    getArticlesOfAuthor: ( username: string, token?: string, limit?: number, offset?: number ) => Promise<ArticleContainer>
    getArticlesForFavoriteUser: ( username: string, token?: string, limit?: number, offset?: number ) => Promise<ArticleContainer>
    getArticlesOfTagged: ( tag: string, token?: string, limit?: number, offset?: number ) => Promise<ArticleContainer>
    getArticlesByFollowingUser: ( token: string, limit?: number, offset?: number ) => Promise<ArticleContainer>

    // {{APIURL}}/articles/{{slug}}
    getArticle: (slug: string, token?: string) => Promise<Article>

    // POST {{APIURL}}/articles
    postArticle: ( token: string, article: PostArticle ) => Promise<Article>

    // PUT {{APIURL}}/articles/{{slug}}
    updateArticle: ( token: string, article: PostArticle, slug: string) => Promise<Article>

    // DELETE {{APIURL}}/articles/{{slug}}
    deleteArticle: ( token: string, slug: string) => Promise<void>

    // POST {{APIURL}}/articles/{{slug}}/favorite
    favorite: ( token: string, slug: string ) => Promise<Article>

    // DEL {{APIURL}}/articles/{{slug}}/favorite
    unfavorite: ( token: string, slug: string ) => Promise<Article>

    // {{APIURL}}/articles/{{slug}}/comments
    getComments: ( slug: string ) => Promise<Comment[]>

    // POST {{APIURL}}/articles/{{slug}}/comments
    postComment: ( token: string, slug: string, comment: string ) => Promise<Comment>

    // DEL {{APIURL}}/articles/{{slug}}/comments/{{commentId}}
    deleteComment: ( token: string, slug: string, commentId: number ) => Promise<void>

    // GET {{APIURL}}/profiles/{{USERNAME}}
    getProfile: ( username: string, token?: string ) => Promise<Profile>

    // POST {{APIURL}}/profiles/{{FOLLOWEE}}/follow
    follow: ( token: string, username: string ) => Promise<Profile>

    // DEL {{APIURL}}/profiles/{{FOLLOWEE}}/follow
    unfollow: ( token: string, username: string ) => Promise<Profile>

    // GET {{APIURL}}/tags
    getTags: () => Promise<string[]>
}

