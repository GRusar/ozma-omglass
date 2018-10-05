import * as Utils from "./utils"

const apiUrl = Utils.isProduction ? "https://api.myxprocess.com" : "http://127.0.0.1:5000"

interface AuthRequest {
    username: string
    password: string
}

interface AuthResponse {
    token: string
}

export interface AuthToken {
    sub: string
    exp: number
}

export interface AllowedEntity {
    fields: Record<string, void>
}

export interface AllowedSchema {
    entities: Record<string, AllowedEntity>
}

export interface AllowedDatabase {
    schemas: Record<string, AllowedSchema>
    systemEntities: Record<string, AllowedEntity>
}

export type ValueType = any[]
export type FieldType = any[]

export interface ColumnField {
    fieldType: FieldType
    defaultValue: any
    isNullable: boolean
}

export interface UpdateFieldInfo {
    name: string
    field: ColumnField
}

export interface ResultColumnInfo {
    name: string
    attributeTypes: Record<string, ValueType>
    cellAttributeTypes: Record<string, ValueType>
    valueType: ValueType
    fieldType: FieldType | null
    punType: ValueType | null
    updateField: UpdateFieldInfo | null
}

export interface EntityRef {
    schema: string | null
    name: string
}


export interface ResultViewInfo {
    attributeTypes: Record<string, ValueType>
    rowAttributeTypes: Record<string, ValueType>
    updateEntity: EntityRef | null
    columns: ResultColumnInfo[]
}

export interface ExecutedValue {
    value: any
    attributes?: Record<string, any>
    pun?: any
}

export interface ExecutedRow {
    values: ExecutedValue[]
    attributes?: Record<string, any>
    id?: number
}

export interface ExecutedViewExpr {
    attributes: Record<string, any>
    columnAttributes: Record<string, any>[]
    rows: ExecutedRow[]
}

export interface ViewExprResult {
    info: ResultViewInfo
    result: ExecutedViewExpr
}

export interface ViewInfoResult {
    info: ResultViewInfo
    pureAttributes: Record<string, any>
    pureColumnAttributes: Record<string, any>[]
}

export const requestAuth = async (username: string, password: string): Promise<string> => {
    const reqBody: AuthRequest = { username, password }
    const resBody: AuthResponse = await Utils.fetchJson(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(reqBody)
    })
    return resBody.token
}

export const parseToken = (token: string): AuthToken => {
    return JSON.parse(atob(token.split('.')[1]))
}

const fetchApi = async (subUrl: string, token: string, method: string, body?: string): Promise<any> => {
    return await Utils.fetchSuccess(`${apiUrl}/${subUrl}`, {
        method,
        headers: {
            "Authorization": `Bearer ${token}`
        },
        body: body
    })
}

const fetchJsonApi = async (subUrl: string, token: string, method: string, body?: any): Promise<any> => {
    return await Utils.fetchJson(`${apiUrl}/${subUrl}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(body)
    })
}

export const renewAuth = async (token: string): Promise<string> => {
    const response: AuthResponse = await fetchJsonApi("auth/renew", token, "POST")
    return response.token
}

export const fetchAllowed = async (token: string): Promise<AllowedDatabase> => {
    return await fetchJsonApi("permissions/allowed", token, "GET")
}

const fetchView = async (path: string, token: string, args: URLSearchParams): Promise<ViewExprResult> => {
    return await fetchJsonApi(`views/${path}/entries?${args}`, token, "GET")
}

const fetchViewInfo = async (path: string, token: string, args: URLSearchParams): Promise<ViewInfoResult> => {
    return await fetchJsonApi(`views/${path}/info?${args}`, token, "GET")
}

export const fetchAnonymousView = async (token: string, query: string, args: URLSearchParams): Promise<ViewExprResult> => {
    args.set("__query", query)
    return await fetchView("anonymous", token, args)
}

export const fetchNamedView = async (token: string, name: string, args: URLSearchParams): Promise<ViewExprResult> => {
    return await fetchView(`by_name/${name}`, token, args)
}

export const fetchNamedViewInfo = async (token: string, name: string, args: URLSearchParams): Promise<ViewInfoResult> => {
    return await fetchViewInfo(`by_name/${name}`, token, args)
}

const changeEntity = async (path: string, method: string, token: string, ref: EntityRef, body?: string): Promise<void> => {
    const schema = ref.schema === null ? "public" : ref.schema
    return await fetchApi(`entity/${schema}/${ref.name}${path}`, token, method, body)
}

export const insertEntity = async (token: string, ref: EntityRef, args: URLSearchParams): Promise<void> => {
    return await changeEntity("", "POST", token, ref, args.toString())
}

export const updateEntity = async (token: string, ref: EntityRef, id: number, args: URLSearchParams): Promise<void> => {
    return await changeEntity(`/${id | 0}`, "PUT", token, ref, args.toString())
}

export const deleteEntity = async (token: string, ref: EntityRef, id: number): Promise<void> => {
    return await changeEntity(`/${id | 0}`, "DELETE", token, ref)
}