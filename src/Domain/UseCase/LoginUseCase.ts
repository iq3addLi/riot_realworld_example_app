export default class LoginUseCase {

    login = ( email: String, password: String, completion: ( error?: Error) => void ) => {
        console.log("email: " + email + ", password: " + password );

        (async () => {
            try {
                const response = await fetch("https://conduit.productionready.io/api/users/login",
                {
                    headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                    },
                    method: "POST",
                    body: JSON.stringify({"user": {"email": email, "password": password}})
                })

                const content = await response.json()
                console.log(JSON.stringify(content))
                completion(null)
            } catch (error) {
                completion(error)
            }
        })()
    }
}
