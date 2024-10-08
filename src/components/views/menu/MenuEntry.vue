<template>
  <b-col :md="entry.size || 12" class="menu-item-column">
    <template v-if="entry.content">
      <div
        :class="[
          'menu_category_block',
          'menuEntry-variant',
          'menuEntry-local-variant',
          {
            'is-mobile': $isMobile,
            'no-content-zero-level': entry.content.length === 0 && level === 1,
            two_levels_max: twoLevelsMax,
          },
        ]"
      >
        <MenuHeading :level="level + 1">
          <span
            class="menu-header menuHeader-variant menuHeader-local-variant"
            :title="$ustOrEmpty(entry.name)"
          >
            {{ $ustOrEmpty(entry.name) }}
          </span>
        </MenuHeading>
        <b-row
          :class="[
            'menu_entries',
            'no-gutters',
            { first_level_entries: level === 0 },
          ]"
        >
          <MenuEntry
            v-for="(subEntry, index) in entry.content"
            :key="index"
            :entry="subEntry"
            :level="level + 1"
            @goto="$emit('goto', $event)"
          />
        </b-row>
      </div>
    </template>
    <template v-else>
      <OzmaLink
        class="menu-entry"
        :link="entry.link"
        @goto="$emit('goto', $event)"
      >
        <i
          :class="[
            'material-icons',
            'icon',
            {
              'no-icon': !entry.icon,
              'emoji-icon': getIconType(entry.icon) === 'emoji',
            },
          ]"
        >
          {{ entry.icon || 'chevron_right' }}
        </i>
        <span class="name" :title="$ustOrEmpty(entry.name)">
          {{ $ustOrEmpty(entry.name) }}
        </span>
        <b-badge
          v-if="entry.badge !== undefined && entry.badge.value !== undefined"
          :class="[
            badgeVariantClassName,
            'badge-local-variant',
            $isMobile ? 'ml-auto' : 'ml-1',
          ]"
          :style="badgeVariantVariables"
          pill
          variant="light"
        >
          {{ entry.badge.value }}
        </b-badge>
      </OzmaLink>
    </template>
  </b-col>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'

import MenuHeading from '@/components/menu/MenuHeading.vue'
import { Link } from '@/links'
import { getIconType } from '@/utils'
import type { ColorVariantAttribute } from '@/utils_colors'
import {
  getColorVariantAttributeClassName,
  getColorVariantAttributeVariables,
} from '@/utils_colors'
import { UserString } from '@/state/translations'

export type Badge = {
  value: unknown
  variant: ColorVariantAttribute
}

interface IMenuBase {
  name: UserString
  size?: number
}

export interface IMenuLink extends IMenuBase {
  icon?: string
  link: Link
  badge?: Badge
}

export interface IMenuCategory extends IMenuBase {
  content: MenuValue[]
}

export type MenuValue = IMenuLink | IMenuCategory

const initialSize = 50
const scaleFactor = 0.85

@Component({ name: 'MenuEntry', components: { MenuHeading } })
export default class MenuEntry extends Vue {
  @Prop({ type: Number, required: false, default: 0 }) level!: number
  @Prop({ type: Object, required: true }) entry!: MenuValue

  get titleStyle(): { fontSize: string } {
    if (this.level > 0) {
      const divider = this.level / scaleFactor
      const fontSize = initialSize / divider
      return { fontSize: `${fontSize}px` }
    }
    const fontSize = initialSize
    return { fontSize: `${fontSize}px` }
  }

  private getIconType(str: string | undefined | null) {
    return getIconType(str)
  }

  private isMenuLink(entry: MenuValue): entry is IMenuLink {
    return 'link' in entry
  }

  private isMenuCategory(entry: MenuValue): entry is IMenuCategory {
    return 'content' in entry
  }

  private isEmptyMenu(entry: MenuValue): entry is IMenuCategory {
    return this.isMenuCategory(entry) && entry.content.length === 0
  }

  private get twoLevelsMax() {
    if (this.level > 0) return false
    if (
      this.isMenuCategory(this.entry) &&
      this.entry.content.some((entry) => this.isMenuCategory(entry))
    )
      return false
    if (this.isEmptyMenu(this.entry)) return false
    return true
  }

  private get badgeVariantClassName(): string | null {
    if (!this.isMenuLink(this.entry)) return null
    if (!this.entry.badge) return null

    return getColorVariantAttributeClassName(this.entry.badge.variant)
  }

  private get badgeVariantVariables(): Record<string, string> | null {
    if (!this.isMenuLink(this.entry)) return null
    if (!this.entry.badge) return null

    return getColorVariantAttributeVariables(this.entry.badge.variant)
  }
}
</script>

<style lang="scss" scoped>
@include variant-to-local('menuEntry');
@include variant-to-local('badge');
@include variant-to-local('menuHeader');

.menu-item-column {
  display: flex;
  flex-direction: column;
  padding: 0 calc(0.625rem / 2);
  @include mobile {
    padding: 0;
  }
}

.menu_category_block {
  margin-top: 0.625rem;
  height: 100%;

  &.is-mobile {
    margin: 0;
    margin-bottom: 0.75rem;
  }

  @media (max-width: 575.98px) {
    margin: 0;
    margin-top: 1rem;
    margin-bottom: 1rem;
  }
}

.no-content-zero-level {
  display: none;
}

.menu_category_block h1,
.menu_category_block h2,
.menu_category_block h3,
.menu_category_block h4,
.menu_category_block h5,
.menu_category_block h6 {
  margin-bottom: 1.25rem;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
}

.menu-entry {
  @include material-button('menuEntry');

  & {
    display: flex;
    align-items: center;
    margin-bottom: 0.25rem;
    border-color: transparent;
    border-radius: 0.25rem;
    background: transparent;
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;

    width: 100%;
    max-width: 100%;
    color: var(--menuEntry-foregroundColor);
    text-decoration: none;
  }

  .icon {
    user-select: none;

    &.no-icon {
      color: var(--menuEntry-foregroundDarkerColor);
    }

    &.emoji-icon {
      font-family: initial;
    }
  }

  .name {
    margin-right: 0.35rem;
    margin-left: 0.35rem;
    overflow: hidden;
    font-size: 1rem;
    text-overflow: ellipsis;
  }
}

.first_level_entries {
  padding-left: 0 !important;
}

.first_level_entries .menu_category_block,
.two_levels_max {
  border: 1px solid var(--default-backgroundDarker1Color);
  border-radius: 0.5rem;
  background: var(--default-backgroundColor);
  padding: 1.875rem;
}

.menu_category_title {
  color: #000;
  font-weight: bold;
}

@media (max-width: 600px) {
  .menu_category_title {
    font-size: 30px !important;
  }

  .menu_entry > a {
    font-size: 20px !important;
  }
}

.menu-header {
  color: var(--menuHeader-foregroundColor);
}

::v-deep {
  .badge {
    background: var(--badge-backgroundColor) !important;
    color: var(--badge-foregroundColor) !important;
  }
}
</style>
