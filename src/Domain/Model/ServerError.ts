export default class ServerError {
    subject: string
    objects: string[]

    constructor(subject: string, objects: string[]) {
        this.subject = subject
        this.objects = objects
    }

    concatObjects = () => {
        let concated = ""
        for ( let index in this.objects ) {
            concated += this.objects[index]
            if ( Number(index) !== this.objects.length - 1 ) {
                concated += ", "
            }
        }
        return concated
    }
}
