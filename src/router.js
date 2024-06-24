import { createRouter, createWebHistory } from 'vue-router';
//import { Authenticator } from 'aws-amplify/auth'; 
//import { Authenticator } from '@aws-amplify/ui-vue';
//import { Authenticator } from '@aws-amplify/ui-vue'
//import { Authenticator, useAuthenticator } from '@aws-amplify/ui-vue';
import { getCurrentUser, fetchAuthSession  } from "aws-amplify/auth";
import { post, get } from 'aws-amplify/api'
//import {Auth} from "aws-amplify/auth";
//import { Auth } from 'aws-amplify';


async function listEditors(limit){
  let apiName = 'AdminQueries';
  let path = '/listUsersInGroup';
  let options = { 
      queryStringParameters: {
        "groupname": "admin",
        "limit": limit,
      },
      headers: {
        'Content-Type' : 'application/json',
        Authorization: `${(await fetchAuthSession()).tokens.accessToken.payload}`
      }
  }
  const response = await get({apiName, path, options});
  return response;
}

// Check if the user is part of the admin group
async function checkAdminStatus() {
  try {
    const session = await fetchAuthSession();
    const groups = session.tokens.accessToken.payload['cognito:groups'];
    
    //console.log(groups);
    //if (groups) {
    if (groups && groups.includes('admin')) {
      // User is an admin
      console.log('User is admin');
      return true;
    } else {
      // User is not an admin
      console.log('User is not admin');
      return false; //Disable this feature for now
      //return false;
    }
  } catch (error) {
    console.error('Error checking admin status', error);
    return false; //Disable this feature for now
    //return false;
  }
}

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import(/* webpackChunkName: "home" */ './components/Home.vue')
  },
  {
    path: '/about',
    name: 'About',
    component: () => import(/* webpackChunkName: "home" */ './components/About.vue')
  },
  {
    path: '/contact',
    name: 'Contact',
    component: () => import(/* webpackChunkName: "home" */ './components/Contact.vue')
  },
  //{
  //  path: '/backTesting',
  //  name: 'BackTesting',
  //  component: () => import(/* webpackChunkName: "home" */ '../components/clientWorkspace/BackTesting.vue'),
  //  meta: { requiresAuth: true}, // Indicates that this route requires authentication and admin access
  //}, 
  {
    path: '/clientWorkspace',
    name: 'ClientWorkspace',
    component: () => import(/* webpackChunkName: "home" */ './components/clientWorkspace/ClientWorkspace.vue'),
    meta: { requiresAuth: true}, // Indicates that this route requires authentication and admin access
    redirect: { name: 'clientWorkspaceHome' },
    children: [
      { path: '/clientWorkspaceHome', name: 'clientWorkspaceHome', component: () => import(/* webpackChunkName: "home" */ './components/clientWorkspace/ClientWorkspaceHome.vue'), meta: { title: 'Home', requiresAuth: true } },
      { path: '/backTesting', component: () => import(/* webpackChunkName: "home" */ './components/clientWorkspace/BackTesting.vue'), meta: { title: 'Back Testing', requiresAuth: true } },
      { path: '/trades', component: () => import(/* webpackChunkName: "home" */ './components/clientWorkspace/Trades.vue'), meta: { title: 'Trades', requiresAuth: true } },
      { path: '/logins', component: () => import(/* webpackChunkName: "home" */ './components/clientWorkspace/Logins.vue'), meta: { title: 'Logins', requiresAuth: true } },
    ],
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import(/* webpackChunkName: "home" */ './components/admin/Admin.vue'),
    meta: { requiresAuth: true, requiresAdmin: true}, // Indicates that this route requires authentication and admin access
    redirect: { name: 'adminHome' },
    children: [
      { path: '/adminHome', name: 'adminHome', component: () => import(/* webpackChunkName: "home" */ './components/admin/AdminHome.vue'), meta: { title: 'Home', requiresAuth: true } },
      { path: '/providers', component: () => import(/* webpackChunkName: "home" */ './components/admin/Providers.vue'), meta: { title: 'Providers', requiresAuth: true } },
      { path: '/brokersAdmin', component: () => import(/* webpackChunkName: "home" */ './components/admin/Brokers.vue'), meta: { title: 'Brokers', requiresAuth: true } },
      { path: '/models', component: () => import(/* webpackChunkName: "home" */ './components/admin/Models.vue'), meta: { title: 'Models', requiresAuth: true } },
    ],
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import(/* webpackChunkName: "home" */ './components/LoginRequired.vue')
  },
  // Other routes...
];


const createRouterWithAuth = (auth) => {
    const router = createRouter({
      history: createWebHistory(),
      routes,
    });
  
    let previousRoute = null;

    /*old version 
    router.beforeEach((to, from, next) => {
        //console.log('Auth route:', auth.route);
        previousRoute = to.fullPath;
        if (to.matched.some((record) => record.meta.requiresAuth) && !auth.user) {
          next({ name: 'Login', query: { redirectTo: previousRoute }, replace: true });
        } else {
          //console.log('in here');
          const isAdmin = checkAdminStatus();
          console.log("i am here");
          console.log(isAdmin);
          if (to.matched.some((record) => record.meta.requiresAdmin) && !isAdmin) {
            console.log("should redirect now");
            next({ name: 'Login', query: { redirectTo: previousRoute }, replace: true });
          } else {
            next();
          }
        }
      });*/

      router.beforeEach(async (to, from, next) => {
        previousRoute = to.fullPath;
      
        if (to.matched.some((record) => record.meta.requiresAuth) && !auth.user) {
          next({ name: 'Login', query: { redirectTo: previousRoute }, replace: true });
        } else {
          try {
            const isAdmin = await checkAdminStatus(); // Wait for the promise to resolve
            if (to.matched.some((record) => record.meta.requiresAdmin) && !isAdmin) {
              next({ name: 'Login', query: { redirectTo: previousRoute }, replace: true });
            } else {
              next();
            }
          } catch (error) {
            console.error('Error checking admin status', error);
            next(); // Proceed to the route if an error occurs (you might want to handle this differently)
          }
        }
      });


  
    return router;
  };
  
//export default router;
export default createRouterWithAuth
