import { expect, test } from 'vite-plus/test'

import { createCompanyService } from './company.service.ts'
import { fakeCompanyRepository } from './fakes.ts'

const setup = () => {
  const repository = fakeCompanyRepository([
    { id: 'c-1', name: 'Acme' },
    { id: 'c-2', name: 'ACME' },
  ])
  return { repository, service: createCompanyService(repository) }
}

test('list returns the repository companies', async () => {
  const { service } = setup()

  await expect(service.list('user-1')).resolves.toHaveLength(2)
})

test('create trims the name and rejects blanks and duplicates', async () => {
  const { service, repository } = setup()

  await expect(service.create('user-1', ' Beta ')).resolves.toMatchObject({ name: 'Beta' })
  expect(repository.companies).toHaveLength(3)
  await expect(service.create('user-1', ' ')).rejects.toMatchObject({ code: 'invalid' })
  await expect(service.create('user-1', 'Acme')).rejects.toMatchObject({ code: 'conflict' })
})

test('rename allows keeping the same name but not taking another company’s', async () => {
  const { service } = setup()

  await expect(service.rename('user-1', 'c-1', 'Acme')).resolves.toEqual({
    id: 'c-1',
    name: 'Acme',
  })
  await expect(service.rename('user-1', 'c-1', 'ACME')).rejects.toMatchObject({
    code: 'conflict',
  })
  await expect(service.rename('user-1', 'missing', 'X')).rejects.toMatchObject({
    code: 'not_found',
  })
})

test('remove refuses a company still in use', async () => {
  const { service, repository } = setup()
  repository.referenced.add('c-1')

  await expect(service.remove('user-1', 'c-1')).rejects.toMatchObject({ code: 'conflict' })
  await service.remove('user-1', 'c-2')

  expect(repository.companies.map((c) => c.id)).toEqual(['c-1'])
})

test('merge validates the ids and delegates to the repository', async () => {
  const { service, repository } = setup()

  await expect(service.merge('user-1', 'c-1', ['c-2', 'c-2'])).resolves.toEqual({
    id: 'c-1',
    name: 'Acme',
  })
  expect(repository.merges).toEqual([{ targetId: 'c-1', sourceIds: ['c-2'] }])

  await expect(service.merge('user-1', 'c-1', [])).rejects.toMatchObject({ code: 'invalid' })
  await expect(service.merge('user-1', 'c-1', ['c-1'])).rejects.toMatchObject({ code: 'invalid' })
  await expect(service.merge('user-1', 'c-1', ['missing'])).rejects.toMatchObject({
    code: 'not_found',
  })
})
