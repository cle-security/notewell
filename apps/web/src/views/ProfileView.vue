<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { api, ApiException } from "../api/client";
import MarkdownView from "../components/MarkdownView.vue";

interface Profile {
  username: string;
  displayName: string;
  bio: string;
  website: string | null;
  createdAt: string;
}

const route = useRoute();
const profile = ref<Profile | null>(null);
const error = ref("");

async function load() {
  error.value = "";
  profile.value = null;
  try {
    const { profile: p } = await api.get<{ profile: Profile }>(
      `/api/profile/${encodeURIComponent(route.params.username as string)}`,
    );
    profile.value = p;
  } catch (e) {
    error.value = e instanceof ApiException ? e.message : "Could not load profile";
  }
}

onMounted(load);
watch(() => route.params.username, load);
</script>

<template>
  <div v-if="profile">
    <h1>{{ profile.displayName }}</h1>
    <p class="muted">@{{ profile.username }} · joined {{ new Date(profile.createdAt).toLocaleDateString() }}</p>
    <p v-if="profile.website">
      <a :href="profile.website" target="_blank">{{ profile.website }}</a>
    </p>
    <MarkdownView :source="profile.bio || '_No bio yet._'" />
  </div>
  <p v-else-if="error" class="error">{{ error }}</p>
  <p v-else class="muted">Loading…</p>
</template>
