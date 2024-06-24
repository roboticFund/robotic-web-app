import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import { configureAuth } from './auth';
import { Amplify } from 'aws-amplify';
import amplifyconfig from './amplifyconfiguration.json';
import createRouterWithAuth from './router';


Amplify.configure(amplifyconfig);

// Configure authentication and store the auth object
const auth = configureAuth();
const router = createRouterWithAuth(auth); 
const app = createApp(App);
app.use(router); 
app.config.globalProperties.$auth = auth;

app.mount('#app');
