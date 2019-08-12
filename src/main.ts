// Import Polyfill
import "fetch-polyfill"

// Import Framework
import { component } from "riot"

// Import application with riot
import application from "./Presentation/application.riot"

// Start Application
component(application)( document.getElementById("application") )

