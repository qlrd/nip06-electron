<template>
  <v-layout>
    <v-flex>
      <v-card>
        <v-card-content>
          <v-layout column wrap>
            <v-flex>
              <QRCodeVue3 value="key"/>
            </v-flex>
            <v-flex>
              {{ key }}
            </v-flex>
          </v-layout>
        </v-card-content>
        <v-card-actions>
          <v-btn
            @click.prevent="close"
          >
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-flex>
  </v-layout>
</template>

<script lang="ts">
import QRCodeVue3 from 'qrcode-vue3'

export default {
  components: {
    QRCodeVue3
  },
  props: {
    key: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    }
  },
  methods: {
    /*
     * @function close
     * Emits 'onClose' to parent component
     */
    close () {
      this.$nextTick(() => {
        this.$emit('onClose', name)
      })
    }
  }
}
</script>
