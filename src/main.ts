// Import Polyfill
import "fetch-polyfill"

// Import Framework
import { component, install } from "riot"

// Import application with riot
import application from "./Presentation/application.riot"

// Install plugin
// install((component) => {
//     const { onBeforeMount } = component
//     component.onBeforeMount = (props, state) => {
//         if (props["ref"]) {
//             props["ref"](component)
//         }
//         onBeforeMount.apply(component, [props, state])
//     }
//     return component
// })

// Start Application
component(application)( document.getElementById("application") )

