import { expect, test } from 'vite-plus/test'

import { fakeCompanyRepository, fakeDepartmentRepository, fakeTopicRepository } from './fakes.ts'
import { createMasterResolver } from './master-resolver.ts'

const setup = () => {
  const companyRepository = fakeCompanyRepository([{ id: 'c-1', name: 'Acme' }])
  const departmentRepository = fakeDepartmentRepository([
    { id: 'd-1', companyId: 'c-1', name: '営業部' },
  ])
  const topicRepository = fakeTopicRepository([{ id: 't-1', kind: 'project', name: 'Apollo' }])
  const resolver = createMasterResolver({
    companyRepository,
    departmentRepository,
    topicRepository,
  })
  return { resolver, companyRepository, departmentRepository, topicRepository }
}

test('company refers to an existing master when the trimmed name matches', async () => {
  const { resolver, companyRepository } = setup()

  await expect(resolver.company('user-1', ' Acme ')).resolves.toEqual({ id: 'c-1', name: 'Acme' })
  expect(companyRepository.companies).toHaveLength(1)
})

test('company creates a master for an unknown name', async () => {
  const { resolver, companyRepository } = setup()

  const company = await resolver.company('user-1', 'Acme Inc.')

  expect(company.name).toBe('Acme Inc.')
  expect(companyRepository.companies).toContainEqual(company)
})

test('departments are resolved per company, deduplicated, and created when missing', async () => {
  const { resolver, departmentRepository } = setup()

  const departments = await resolver.departments('user-1', 'c-1', [
    '営業部',
    ' 開発部',
    '営業部',
    '',
  ])

  expect(departments.map((d) => d.name)).toEqual(['営業部', '開発部'])
  expect(departments[0]?.id).toBe('d-1')
  expect(departmentRepository.departments).toHaveLength(2)
})

test('topics are resolved per kind', async () => {
  const { resolver, topicRepository } = setup()

  const [project] = await resolver.topics('user-1', 'project', ['Apollo'])
  const [group] = await resolver.topics('user-1', 'group', ['Apollo'])

  expect(project?.id).toBe('t-1')
  expect(group).toMatchObject({ kind: 'group', name: 'Apollo' })
  expect(group?.id).not.toBe('t-1')
  expect(topicRepository.topics).toHaveLength(2)
})
