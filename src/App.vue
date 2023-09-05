<template>
  <v-layout column wrap class="align-center justify-center">
    <v-dialog
      v-model="dialog"
      width="auto"
    >
      <v-card>
        <v-card-title>
          {{ error.name }}
        </v-card-title>
        <v-card-item>
          {{ error.message }}
        </v-card-item>
        <v-card-actions>
          <v-btn variant="tonal" block @click="closeDialog">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-card variant="tonal">
      <v-card-title>
        NIP-06 | Electron
      </v-card-title>
      <v-card-subtitle>
        Basic key derivation from mnemonic seed phrase
      </v-card-subtitle>
      <v-card-text>        
        You can enter an existing <a href="https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki" target="_blank" class="font-medium text-indigo-600">BIP39 mnemonic</a>, or generate a new random one.
      </v-card-text>
      <v-card-item row wrap>
        <v-btn
          @click.prevent="generateRandomSeed"
          variant="tonal"
          class="ma-2"
        >
          Generate random mnemonic
        </v-btn>
        <v-btn
          v-if="isFilled"
          @click.prevent="reset"
          variant="tonal"
          class="ma-2"
        >
          Reset
        </v-btn>
      </v-card-item>
      <v-card-item v-if="isFilled">
        <v-card-text :color="isValid ? '#00ff00' : '#ff0000'"> Seed words are {{ isValid ? '' : 'not' }} valid </v-card-text>
      </v-card-item>
      <v-card-item>
        <v-container>
          Seed
          <v-row no-gutters>
            <v-col 
              v-for="(word, n) in seedWords"
              :key="`word-${n}`"
              :cols="seedWords.length / 3"
              sm="4"
            >
              <v-text-field
                @paste.prevent="onPasteSeed"
                v-model="seedWords[n]"
                :label="`Word ${n + 1}`"
                required
                class="pa-1"
              />
            </v-col>
            <v-col cols="12" sm="12"> 
              <v-text-field
                v-model="passphrase"
                type="password"
                label="13th word (passphrase)"
                class="pa-1"
              />
            </v-col>
            <v-col cols="12" sm="12">
              <v-text-field
                v-model="password"
                type="password"
                label="Encrypt with password (NIP-19)"
                required
                class="pa-1"
              />
            </v-col>
          </v-row>
        </v-container>
      </v-card-item>
      <v-card-item v-if="isValid">
        <v-container>
          <v-row no-gutters>
            <v-col class="pa-1">
              <v-btn
                @click.prevent="showPubAndEncryptedPrvKeys"
                variant="tonal"
              > 
                Show keys
              </v-btn>
              <v-overlay
                v-model="overlay"
                contained
                class="align-center justify-center"
              >
                <v-card 
                  color="#952175"
                  theme="dark"
                >
                  <v-card-title>
                    Key Pair
                  </v-card-title>
                  <v-card-subtitle>
                    Encrypted private / Public keys
                  </v-card-subtitle>
                  <v-card-item align="center" justify="center">
                    <v-row no-gutters>
                      <v-col col="6" sm="6" class="pa-12">
                        <v-card variant="tonal">
                          <v-card-subtitle>
                            Encrypted private Key
                          </v-card-subtitle>
                          <v-card-item>
                            <QrcodeVue
                              :value="prv"
                              :size="qrcode.size"
                              :level="qrcode.level"
                              :render-as="qrcode.renderAs"
                              :margin="qrcode.margin"
                              :background="qrcode.background"
                              :foreground="qrcode.foreground"
                            />
                          </v-card-item>
                        </v-card>
                      </v-col>
                      <v-col col="6" sm="6" class="pa-12">
                        <v-card variant="tonal">
                          <v-card-subtitle>
                            Public Key
                          </v-card-subtitle>
                          <v-card-item>
                            <QrcodeVue
                              :value="pub"
                              :size="qrcode.size"
                              :level="qrcode.level"
                              :render-as="qrcode.renderAs"
                              :margin="qrcode.margin"
                              :background="qrcode.background"
                              :foreground="qrcode.foreground"
                            />
                          </v-card-item>
                        </v-card>
                      </v-col>
                    </v-row>
                    <v-row no-gutters>
                      <v-col col="12" sm="12" class="pa-2">
                        prv key: <v-chip> {{ prv }} </v-chip>
                      </v-col>
                      <v-col col="12" sm="12" class="pa-2">
                        pub key: <v-chip> {{ pub }} </v-chip>
                      </v-col>
                      <v-col col="12" sm="12" class="pa-2">
                        <v-btn
                          size="x-large"
                          rounded="xl"
                          variant="tonal"
                          @click.prevent="cleanHexFormat"
                        >
                          Close
                        </v-btn>
                      </v-col>
                    </v-row>
                  </v-card-item>
                  <v-card-actions align="center">
                  </v-card-actions>
                </v-card>
              </v-overlay>
            </v-col>
          </v-row>
        </v-container>
      </v-card-item>
      <v-card-item>
        <p> 
          v{{ version }} | made by <a href="https://github.com/jaonoctus/nip06-web" target="_blank" class="font-medium text-indigo-600">jaonoctus</a> | forked by <a href="https://github.com/qlrd/nip06-electron" target="_blank" class="font-medium text-indigo-600">qlrd</a>
        </p>
      </v-card-item>
    </v-card>
  </v-layout>
</template>

<script lang="ts">
import QrcodeVue from 'qrcode.vue'

export default {
  components: {
    QrcodeVue
  },
  data () {
    return {
      version: '',    
      password: '',
      passphrase: '',
      seedWords: ['', '', '', '', '', '', '', '', '', '', '', ''],
      isValid: false,
      isFilled: false,
      prv: '',
      pub: '',
      overlay: false,
      qrcode: {
        size: 320,
        level: ('H' as any),
        margin: 3,
        background: '#ffffff',
        foreground: '#000000',
        renderAs: ('svg' as any)
      },
      dialog: false,
      error: { 
        name: '',
        message: ''
      }
    }
  },
  onBeforeMount () {
    this.reset()
  },
  /*
   * @function created
   * Initialize callback handlers (invoke, onSuccess and onError)
   * from ipcMain and ipcRenderer:
   *   - window:log            --> simple logs
   *   - nip06:get:version     --> get current version of electron application
   *   - nip06:generate:seed   --> generated the seed with as 12 word mnemonic
   *   - nip06:validate:seed   --> validate the seed (this will automatically be called when nip06:generate:seed is invoked)
   *   - nip06:create:keys:hex --> create private and public keys in hex format 
   *   - nip06:create:keys:bech32 --> create private and public keys in bech32 format
   */
  async created () {
    window.api.onSuccess('window:log', (_: any, value: any) => {
      console.log(value)
    })

    window.api.onSuccess('nip06:get:version', (_: any, value: any) => {
      this.$nextTick(() => {
        this.version = value
      })
    })

    window.api.onSuccess('nip06:generate:seed', (_: any, value: any) => { 
      this.$nextTick(async () => {
        this.fillMnemonic(value)
        await window.api.invoke('nip06:validate:seed', value)
      })
    })

    window.api.onSuccess('nip06:validate:seed', (_: any, value: any) => {
      this.$nextTick(() => {
        this.isValid = value
      })
    })

    window.api.onSuccess('nip06:create:keys', (_: any, value: any) => {
      this.$nextTick(() => {
        this.prv = value.prv
        this.pub = value.pub
        this.overlay = true
      })
    })
    
    window.api.onError('nip06:get:version', this.openDialog)
    window.api.onError('nip06:generate:seed', this.openDialog)
    window.api.onError('nip06:validate:seed', this.openDialog)
    window.api.onError('nip06:create:keys', this.openDialog)
    
    await window.api.invoke('nip06:get:version')
  },
  methods: {
    /*
     * @function resetForm
     * Clear seedWords and passphrase data
     */
    reset () {
      this.isValid = false
      this.isFilled = false
      this.seedWords = ['', '', '', '', '', '', '', '', '', '', '', ''],
      this.password = ''
      this.passphrase = ''
      this.prv = ''
      this.pub = ''
      this.overlay = false
    },
    /*
     * @function openDialog
     * populate data and open dialog
     */
    openDialog (_: any, error: any) {
      this.$nextTick(() => {
        this.error.name = error.name
        this.error.message = error.message
        this.dialog = true
      })
    },
    /*
     * @function closeDialog
     * clean and close dialog
     */
    closeDialog () {
      this.$nextTick(() => {
        this.error.name = ''
        this.error.message = ''
        this.dialog = false
      })
    },
    /*
     * @function generateRandomMnemonic
     * Calls nostr-tools's nip06.generateSeedWords method
     * inside of electron isolated process
     */
    async generateRandomSeed () {
      await window.api.invoke('nip06:generate:seed')
    },
    /*
     * @function fillMnemonic
     * Fills the string with separated spaces within seedWords array
     */
    fillMnemonic(mnemonic: string) {
      let count = 0
      mnemonic.split(' ').forEach((word, index) => {
        this.seedWords[index] = word
        count += 1
      })
      this.isFilled = count === 12
    },
    /*
     * @function onPasteSeed
     * Copy a seed from clipboardData to seedWords object
     */
    async onPasteSeed(event: ClipboardEvent) {
      const newMnemonic = event.clipboardData?.getData('text')
      if (newMnemonic) {
        this.fillMnemonic(newMnemonic)
        await window.api.invoke('nip06:validate:seed', newMnemonic)
      }
    },
    /*
     * @function createHexFormat
     * Create a private/public key pair in hex format from seed words (and passphrase)
     */
    async showPubAndEncryptedPrvKeys () {
      await window.api.invoke('nip06:create:keys', {
        mnemonic: this.seedWords.join(' ').trim(),
        passphrase: this.passphrase,
        password: this.password
      })
    },
    /*
     * @function cleanHexFormat
     * Cleans the private/public key pair in hex format from seed words (and passphrase)
     */
    cleanHexFormat () {
      this.prv = ''
      this.pub = ''
      this.overlay = false
    },
    /*
     * @function createBech32Format
     * Create a private/public key pair in hex format from seed words (and passphrase)
     */
    async createBech32Format () {
      await window.api.invoke('nip06:create:keys:bech32', {
        mnemonic: this.seedWords.join(' ').trim(),
        passphrase: this.passphrase
      })
    },
    /*
     * @function cleanBech32Format
     * Cleans the private/public key pair in hex format from seed words (and passphrase)
     */
    cleanBech32Format () {
      this.prv = ''
      this.pub = ''
      this.overlay = false
    },
  }
}
</script>
