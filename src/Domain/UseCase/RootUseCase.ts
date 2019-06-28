import Article from "../Model/Article"
import Author from "../Model/Author"

import ConduitProductionRepository from "../Repository/ConduitProductionRepository"
import UserLocalStorageRepository from "../Repository/UserLocalStorageRepository"

export default class RootUseCase {

    conduit = new ConduitProductionRepository()
    storage = new UserLocalStorageRepository()

    requestArticles = ( completion: (articles: Article[], error?: Error) => void ) => {
        // stub

        // {
        //     "title": "HUI",
        //     "slug": "hui-k6rjbg",
        //     "body": "# adad\n## adad\n*qwe",
        //     "createdAt": "2019-06-20T08:09:46.868Z",
        //     "updatedAt": "2019-06-20T08:09:46.868Z",
        //     "tagList": [],
        //     "description": "DEATH",
        //     "author": {
        //         "username": "andersdeath",
        //         "bio": null,
        //         "image": "https://static.productionready.io/images/smiley-cyrus.jpg",
        //         "following": false
        //     },
        //     "favorited": false,
        //     "favoritesCount": 0
        // },
        let articles = [
            new Article(
                "HUI",
                "hui-k6rjbg",
                "# adad\n## adad\n*qwe",
                "2019-06-20T08:09:46.868Z",
                "2019-06-20T08:09:46.868Z",
                ["hoge", "huga"],
                "DEATH",
                new Author("andersdeath", "https://static.productionready.io/images/smiley-cyrus.jpg", false, null),
                false,
                0
            ),
            new Article(
                "HUI",
                "hui-k6rjbg",
                "# adad\n## adad\n*qwe",
                "2019-06-20T08:09:46.868Z",
                "2019-06-20T08:09:46.868Z",
                ["hoge", "huga"],
                "DEATH",
                new Author("andersdeath", "https://static.productionready.io/images/smiley-cyrus.jpg", false, null),
                false,
                0
            )
        ]

        completion(articles)
    }

    requestTags = () => {
        return this.conduit.getTags()
    }

    isLoggedIn = () => {
        return this.storage.isLoggedIn()
    }
}
