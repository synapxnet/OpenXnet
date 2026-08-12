/**
 * LadybugDB Schema Definitions
 *
 * Hybrid Schema:
 * - Separate node tables for each code element type (File, Function, Class, etc.)
 * - Single CodeRelation table with 'type' property for all relationships
 *
 * This allows LLMs to write natural Cypher queries like:
 *   MATCH (f:Function)-[r:CodeRelation {type: 'CALLS'}]->(g:Function) RETURN f, g
 */
import { NODE_TABLES, REL_TABLE_NAME, REL_TYPES, EMBEDDING_TABLE_NAME } from 'gitnexus-shared';
export { NODE_TABLES, REL_TABLE_NAME, REL_TYPES, EMBEDDING_TABLE_NAME };
export type { NodeTableName, RelType } from 'gitnexus-shared';
export declare const FILE_SCHEMA = "\nCREATE NODE TABLE File (\n  id STRING,\n  name STRING,\n  filePath STRING,\n  content STRING,\n  PRIMARY KEY (id)\n)";
export declare const FOLDER_SCHEMA = "\nCREATE NODE TABLE Folder (\n  id STRING,\n  name STRING,\n  filePath STRING,\n  PRIMARY KEY (id)\n)";
export declare const FUNCTION_SCHEMA = "\nCREATE NODE TABLE Function (\n  id STRING,\n  name STRING,\n  filePath STRING,\n  startLine INT64,\n  endLine INT64,\n  isExported BOOLEAN,\n  content STRING,\n  description STRING,\n  PRIMARY KEY (id)\n)";
export declare const CLASS_SCHEMA = "\nCREATE NODE TABLE Class (\n  id STRING,\n  name STRING,\n  filePath STRING,\n  startLine INT64,\n  endLine INT64,\n  isExported BOOLEAN,\n  content STRING,\n  description STRING,\n  PRIMARY KEY (id)\n)";
export declare const INTERFACE_SCHEMA = "\nCREATE NODE TABLE Interface (\n  id STRING,\n  name STRING,\n  filePath STRING,\n  startLine INT64,\n  endLine INT64,\n  isExported BOOLEAN,\n  content STRING,\n  description STRING,\n  PRIMARY KEY (id)\n)";
export declare const METHOD_SCHEMA = "\nCREATE NODE TABLE Method (\n  id STRING,\n  name STRING,\n  filePath STRING,\n  startLine INT64,\n  endLine INT64,\n  isExported BOOLEAN,\n  content STRING,\n  description STRING,\n  parameterCount INT32,\n  returnType STRING,\n  PRIMARY KEY (id)\n)";
export declare const CODE_ELEMENT_SCHEMA = "\nCREATE NODE TABLE CodeElement (\n  id STRING,\n  name STRING,\n  filePath STRING,\n  startLine INT64,\n  endLine INT64,\n  isExported BOOLEAN,\n  content STRING,\n  description STRING,\n  PRIMARY KEY (id)\n)";
export declare const COMMUNITY_SCHEMA = "\nCREATE NODE TABLE Community (\n  id STRING,\n  label STRING,\n  heuristicLabel STRING,\n  keywords STRING[],\n  description STRING,\n  enrichedBy STRING,\n  cohesion DOUBLE,\n  symbolCount INT32,\n  PRIMARY KEY (id)\n)";
export declare const PROCESS_SCHEMA = "\nCREATE NODE TABLE Process (\n  id STRING,\n  label STRING,\n  heuristicLabel STRING,\n  processType STRING,\n  stepCount INT32,\n  communities STRING[],\n  entryPointId STRING,\n  terminalId STRING,\n  PRIMARY KEY (id)\n)";
export declare const STRUCT_SCHEMA: string;
export declare const ENUM_SCHEMA: string;
export declare const MACRO_SCHEMA: string;
export declare const TYPEDEF_SCHEMA: string;
export declare const UNION_SCHEMA: string;
export declare const NAMESPACE_SCHEMA: string;
export declare const TRAIT_SCHEMA: string;
export declare const IMPL_SCHEMA: string;
export declare const TYPE_ALIAS_SCHEMA: string;
export declare const CONST_SCHEMA: string;
export declare const STATIC_SCHEMA: string;
export declare const VARIABLE_SCHEMA: string;
export declare const PROPERTY_SCHEMA: string;
export declare const RECORD_SCHEMA: string;
export declare const DELEGATE_SCHEMA: string;
export declare const ANNOTATION_SCHEMA: string;
export declare const CONSTRUCTOR_SCHEMA: string;
export declare const TEMPLATE_SCHEMA: string;
export declare const MODULE_SCHEMA: string;
export declare const ROUTE_SCHEMA = "\nCREATE NODE TABLE Route (\n  id STRING,\n  name STRING,\n  filePath STRING,\n  responseKeys STRING[],\n  errorKeys STRING[],\n  middleware STRING[],\n  PRIMARY KEY (id)\n)";
export declare const TOOL_SCHEMA = "\nCREATE NODE TABLE Tool (\n  id STRING,\n  name STRING,\n  filePath STRING,\n  description STRING,\n  PRIMARY KEY (id)\n)";
export declare const SECTION_SCHEMA = "\nCREATE NODE TABLE Section (\n  id STRING,\n  name STRING,\n  filePath STRING,\n  startLine INT64,\n  endLine INT64,\n  level INT64,\n  content STRING,\n  description STRING,\n  PRIMARY KEY (id)\n)";
export declare const RELATION_SCHEMA: string;
export declare const EMBEDDING_DIMS: number;
/** HNSW vector index name for the CodeEmbedding table. */
export declare const EMBEDDING_INDEX_NAME = "code_embedding_idx";
/**
 * Sentinel value for "no content hash available" — used in legacy DBs and null rows.
 * Nodes with this hash are always treated as stale and re-embedded.
 */
export declare const STALE_HASH_SENTINEL = "";
export declare const EMBEDDING_SCHEMA: string;
/**
 * Create vector index for semantic search
 * Uses HNSW (Hierarchical Navigable Small World) algorithm with cosine similarity
 */
export declare const CREATE_VECTOR_INDEX_QUERY: string;
export declare const NODE_SCHEMA_QUERIES: string[];
export declare const REL_SCHEMA_QUERIES: string[];
export declare const SCHEMA_QUERIES: string[];
