import { createApp } from 'vue'
import { createVuetify } from 'vuetify'
import App from './App.vue'

//import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import "./style.css" 

const vuetify = createVuetify()

createApp(App)
  .use(vuetify)
  .mount('#app')
  .$nextTick(() => {
    postMessage({ payload: 'removeLoading' }, '*')
  })
