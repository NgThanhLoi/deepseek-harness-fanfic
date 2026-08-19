import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  LOADER_SMOKE_TEST_TIMEOUT_MS,
  runLoaderSmoke,
} from '@deepseek-ai/dsh-loader-smoke'

const fixtureDir = fileURLToPath(new URL(
  '../../../../examples/acp-agent/tests/fixtures/fanfic/distributed/',
  import.meta.url,
))
const driver = join(fixtureDir, 'driver.ts')
const configPath = join(fixtureDir, 'cordis.yml')
const repoTsconfig = fileURLToPath(new URL('../../../../tsconfig.json', import.meta.url))

describe('distributed fanfic public Loader composition', () => {
  it('registers the three model-visible orchestration schemas and central-author policy without starting a child', async () => {
    const { stdout, stderr } = await runLoaderSmoke({
      label: 'distributed fanfic Loader composition',
      tempDirPrefix: 'dsh-fanfic-distributed-loader-',
      binScript: driver,
      libBinScript: driver,
      configPath,
      tsconfigPath: repoTsconfig,
    })

    expect(stderr).toBe('')
    expect(JSON.parse(stdout)).toEqual({
      tools: [
        {
          name: 'fanfic_prepare_chapter',
          parameterNames: ['asOfChapter', 'branchId', 'fanficChapter', 'forceRefresh', 'participants', 'povCharacter', 'query', 'roles', 'sceneGoal'],
          required: ['asOfChapter', 'branchId', 'fanficChapter', 'povCharacter', 'sceneGoal'],
        },
        {
          name: 'fanfic_review_draft',
          parameterNames: ['asOfChapter', 'branchId', 'draftId', 'forceRefresh', 'participants', 'povCharacter', 'sceneGoal'],
          required: ['asOfChapter', 'branchId', 'draftId', 'povCharacter', 'sceneGoal'],
        },
        {
          name: 'fanfic_worker_status',
          parameterNames: [],
          required: [],
        },
      ],
      policy: {
        hasApi: true,
        centralAuthor: true,
        readOnlySpecialists: true,
        deterministicAuditsRemainMandatory: true,
      },
    })
  }, LOADER_SMOKE_TEST_TIMEOUT_MS)
})
