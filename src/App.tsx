import './App.css'
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import {
  ApolloClient,
  ApolloProvider,
  createHttpLink,
  from,
  InMemoryCache,
} from '@apollo/client'
import React, { useContext, createContext, useState, useEffect } from 'react'
import { setContext } from '@apollo/client/link/context'
import { onError } from '@apollo/client/link/error'
import firebase from 'firebase/compat/app'
import {
  getUserLogin,
  removeUserLogin,
  setUserLogin,
} from './util/localStorageHelper'
import Dashboard from './pages/Dashboard'
import User from './pages/user'
import LoginLayout from './layouts/LoginLayout'
import Login from './pages/Login'
import {
  AuthContextType,
  NotificationAlert,
  NotificationAlertContextType,
  UserLogin,
} from './interfaces'
import Outlet from './pages/outlet'
import firebaseApp from './firebase'
// import { getMessaging } from 'firebase/messaging/sw'
import { getMessaging, onMessage, getToken } from 'firebase/messaging'
const authProvider = {
  isAuthenticated: false,
  signin(callback: VoidFunction) {
    authProvider.isAuthenticated = true
    callback()
  },
  signout(callback: VoidFunction) {
    authProvider.isAuthenticated = false
    // removeUserLogin()
    callback()
  },
}

const AuthContext = createContext<AuthContextType>(null!)
const NotificationAlertContext = createContext<NotificationAlertContextType>(
  null!,
)

function AuthProvider({ children }: { children: React.ReactNode }) {
  let [user, setUser] = useState<UserLogin | null>(getUserLogin())

  let signin = (newUser: UserLogin, callback: VoidFunction) => {
    return authProvider.signin(() => {
      setUserLogin(newUser)
      setUser(newUser)
      callback()
    })
  }

  let signout = (callback: VoidFunction) => {
    return authProvider.signout(() => {
      setUser(null)
      callback()
    })
  }
  return (
    <AuthContext.Provider value={{ user, signin, signout }}>
      {children}
    </AuthContext.Provider>
  )
}

function NotificationAlertProviver({
  children,
}: {
  children: React.ReactNode
}) {
  let [alert, setNotification] = useState<NotificationAlert | null>(null)

  let setNotificationAlert = (notification: NotificationAlert) => {
    setNotification(notification)
    // console.log(notification)
  }
  return (
    <NotificationAlertContext.Provider value={{ alert, setNotificationAlert }}>
      {children}
    </NotificationAlertContext.Provider>
  )
}

const httpLink = createHttpLink({
  uri: process.env.REACT_APP_DOMAIN + '/graphql',
})

const authLink = setContext((_, { headers }) => {
  const userLogin = getUserLogin()
  return {
    headers: {
      ...headers,
      authorization: userLogin ? `Bearer ${userLogin.token}` : '',
    },
  }
})

export function useAuth() {
  return useContext(AuthContext)
}

export function useNotificationAlert() {
  return useContext(NotificationAlertContext)
}

function RequireAuth({ children }: { children: JSX.Element }) {
  let auth = useAuth()
  let location = useLocation()

  if (!auth.user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

function App() {
  /**
   * Firebase
   */

  const messaging = getMessaging(firebaseApp)
  getToken(messaging, {
    vapidKey:
      'BKI_tuShCVxm36pxA-OBou780j_SfYqgIB-TfFaoJCBHhcjmPPRaFc1CLDVQE-ENo_mxqCtNY6733Q_MCCM5bSk',
  }).then((text) => console.log(text))
  // const messaging = getMessaging();
  onMessage(messaging, (payload) => {
    console.log('Message received. ', payload);
    // ...
  });
  // const messaging2 = getMessaging()
  // onMessage(messaging, (payload) => {
  //   console.log('Message received. ', payload)
  //   // ...
  // })

  const [isAuthenticated, setIsAuthenticated] = useState(true)
  const navigate = useNavigate()
  const errorLink = onError(
    ({ graphQLErrors, networkError, operation, forward }) => {
      if (graphQLErrors) {
        for (let err of graphQLErrors) {
          switch (err.extensions.code) {
            // Apollo Server sets code to UNAUTHENTICATED
            case 'UNAUTHENTICATED':
              console.log('UNAUTHENTICATED')
              authProvider.signout(() => {
                removeUserLogin()
                setIsAuthenticated(false)
              })
          }
        }
      }
      if (networkError) {
        console.log(`[Network error]: ${networkError}`)
      }
    },
  )
  const client = new ApolloClient({
    link: from([errorLink, authLink.concat(httpLink)]),
    cache: new InMemoryCache(),
  })

  useEffect(() => {
    if (!isAuthenticated) {
      authProvider.signout(() => {
        navigate('/login', { state: { from: 'somewhere' } })
      })
    }
  }, [isAuthenticated])

  return (
    <AuthProvider>
      <NotificationAlertProviver>
        <ApolloProvider client={client}>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route
                index
                element={
                  <RequireAuth>
                    <Dashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="user"
                element={
                  <RequireAuth>
                    <User />
                  </RequireAuth>
                }
              />
              <Route
                path="outlet"
                element={
                  <RequireAuth>
                    <Outlet />
                  </RequireAuth>
                }
              />
            </Route>
            <Route path="/login" element={<LoginLayout />}>
              <Route index element={<Login />} />
            </Route>
          </Routes>
        </ApolloProvider>
      </NotificationAlertProviver>
    </AuthProvider>
  )
}

export default App
