<template>
  <v-layout column wrap>
    <v-flex> 
      <v-card>
        <v-card-text>
          You can enter an existing <a href="https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki" target="_blank" class="font-medium text-indigo-600">BIP39 mnemonic</a>, or generate a new random one.
        </v-card-text>
        <v-card-action>
          <v-layout row wrap>
            <v-flex>
              <v-button
                @click.prevent="generateRandomMnemonic"
              >
                Generate random mnemonic
              </v-button>
              <v-button
                v-if="isFilled"
                @click.prevent="reset"
              >
                Reset
              </v-button>
            </v-flex>
          </v-layout>
        </v-card-action>
      </v-card>
    </v-flex>
    <v-flex>
      <v-form>
        <v-layout row wrap>
          <v-flex
            v-for="(word, n) in seedWords"
            :key="`word-${n}`"
          >
            <v-text-field
              @paste.prevent="onPasteSeed"
              v-model="seedWords[n]"
              :label="`Word ${n}`"
              required
            />
          </v-flex>
          <v-flex> 
            <v-text-field
              :value="passphrase"
              @input="$emit('update:modelValue', $event.target.value)"
              type="password"
              :label="`Passphrase`"
              required
            />
          </v-flex>
        </v-layout>
      </v-form>
    </v-flex>
    <v-flex v-if="isValid">
      <v-layout row wrap>
        <v-flex>
          <v-button
            @click.prevent="toggleFormat"
            :color="isHexFormat ? 'purple' : 'grey'"
          >
            Hex Format
          </v-button>
        </v-flex>
        <v-flex>
          <v-button
            @click.prevent="toogleFormat"
            :color="isHexFormat ? 'grey' : 'purple'"
          >
            Bech32 Format
          </v-button>
        </v-flex>
      </v-layout>
    </v-flex>
  </v-layout>
</template>

<script lang="ts">
export default {
  props: {
    seedWords: {
      type: Array,
      required: true
    },
    passphrase: {
      type: String,
      required: true
    },
    isValid: {
      type: Boolean,
      required: true
    },
    isFilled: {
      type: Boolean,
      required: true
    },
    isHexFormat: {
      type: Boolean,
      required: true
    }
  },
  methods: {
    /*
     * @function generateRandomMnemonic
     * Emits 'onGenerateRandomMnemonic' event to parent component
     */
    generateRandomMnemonic () {
      this.$nextTick(() => {
        this.emit('onGenerateRandomMnemonic')
      })
    },
    /*
     * @function reset
     * Emits 'onReset' event to parent component
     */
    reset() {
      this.$nextTick(() => {
        this.$emit('onReset')
      })
    },
    /*
     * @function toogleFormat
     * Emits 'onToogleFormat' to parent component
     */
    toggleFormat () {
      this.$nextTick(() => {
        this.$emit('onToggleFormat')
      })
    },
    /*
     * @function fillMnemonic
     * Emits 'fillMnemonic' event to parent component
     */
    fillMnemonic(mnemonic: string) {
      this.$nextTick(() => {
        this.$emit('onFillMnemonic', mnemonic)
      })
    },
    /*
     * @function onPasteSeed
     * Copy a seed from clipboardData to seedWords object
     */
    onPasteSeed () { 
      const mnemonic = event.clipboard?.getData('text')
      if (mnemonic) {
        this.fillMnemonic(mnemonic)
      }
    }
  } 
}
</script>
